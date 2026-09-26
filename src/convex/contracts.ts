import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertCanAccessRecord,
  assertRecordVisible,
  assertStaff,
  getViewer,
  resolveBranchFilter,
} from "./access";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const contractStatusValidator = v.union(
  v.literal("current"),
  v.literal("delinquent_30"),
  v.literal("delinquent_60"),
  v.literal("delinquent_90"),
  v.literal("lapsed"),
  v.literal("fully_paid"),
);

/**
 * List contracts, optionally filtered by client or status.
 */
export const list = query({
  args: {
    clientId: v.optional(v.id("clients")),
    status: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const branchId = await resolveBranchFilter(ctx, args.branchId);
    let contracts;

    if (branchId) {
      contracts = await ctx.db
        .query("contracts")
        .withIndex("by_branch", (q) => q.eq("branchId", branchId!))
        .order("desc")
        .collect();
      // Optionally narrow by client or status within the branch
      if (args.clientId) {
        contracts = contracts.filter((c) => String(c.clientId) === String(args.clientId));
      }
      if (args.status) {
        contracts = contracts.filter((c) => c.contractStatus === args.status);
      }
    } else if (args.clientId) {
      contracts = await ctx.db
        .query("contracts")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId!))
        .order("desc")
        .collect();
    } else if (args.status) {
      contracts = await ctx.db
        .query("contracts")
        .withIndex("by_status", (q) =>
          q.eq("contractStatus", args.status as any)
        )
        .order("desc")
        .collect();
    } else {
      contracts = await ctx.db.query("contracts").order("desc").collect();
    }

    // Attach client info with one read per distinct client instead of one read
    // per contract (N+1).
    const clientIds = Array.from(new Set(contracts.map((c) => c.clientId)));
    const clientDocs = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientById = new Map(
      clientIds.map((id, i) => [id, clientDocs[i]] as const)
    );

    return contracts.map((c) => ({
      ...c,
      client: clientById.get(c.clientId) ?? null,
    }));
  },
});

/**
 * Get a single contract with full details.
 */
export const get = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract) return null;

    const client = await ctx.db.get(contract.clientId);
    // The contract's own branch, falling back to its planholder's for rows
    // written before branch backfill.
    await assertRecordVisible(ctx, contract.branchId ?? client?.branchId);
    return { ...contract, client };
  },
});

/**
 * Create a new contract for a client.
 */
export const create = mutation({
  args: {
    clientId: v.id("clients"),
    contractNumber: v.string(),
    planType: v.string(),
    planAmount: v.number(),
    monthlyAmortization: v.number(),
    startDate: v.number(),
    maturityDate: v.optional(v.number()),
    assignedAgent: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Auto-assign branchId from the current user's profile
    const currentUserDoc = await ctx.db.get(userId);
    const branchId = currentUserDoc?.branchId;

    // Get client's branch if available
    const clientDoc = await ctx.db.get(args.clientId);
    if (!clientDoc) throw new Error("Client not found");
    const clientBranchId = clientDoc?.branchId;

    // Branch staff may only create contracts for clients of their own branch.
    await assertCanAccessRecord(ctx, clientBranchId ?? branchId);

    const contractId = await ctx.db.insert("contracts", {
      ...args,
      branchId: branchId ?? clientBranchId ?? undefined,
      totalPaid: 0,
      contractStatus: "current",
      createdAt: Date.now(),
      createdBy: userId,
    });

    // Log audit entry
    const user = await ctx.db.get(userId);
    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "contract",
      entityId: contractId,
      userId,
      userName: user?.name || user?.email || "Unknown",
      description: `Contract ${args.contractNumber} created for ${args.planType} (${formatPHP(args.planAmount)})`,
      newValues: {
        contractNumber: args.contractNumber,
        planType: args.planType,
        planAmount: args.planAmount,
        monthlyAmortization: args.monthlyAmortization,
      },
      timestamp: Date.now(),
    });

    return contractId;
  },
});

/**
 * Edit a contract's core details.
 *
 * Only Head Office (Super Admin, CEO) and finance staff may edit a contract —
 * a cashier or collector corrects payments, not the plan itself. Every changed
 * field is written to the audit log with before/after values, because the
 * contract number, plan value and effectivity date are what the Statement of
 * Account and every report are built from.
 *
 * Changing the effectivity date (startDate) also cascades to any stored
 * payment schedules so the derived due dates on screen and on paper stay in
 * step with the schedule table.
 */
export const update = mutation({
  args: {
    contractId: v.id("contracts"),
    contractNumber: v.string(),
    planType: v.string(),
    planAmount: v.number(),
    monthlyAmortization: v.number(),
    startDate: v.number(),
    maturityDate: v.optional(v.number()),
    contractStatus: contractStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const viewer = await getViewer(ctx);
    if (!viewer) throw new Error("Not authenticated");
    const allowed =
      viewer.role === "super_admin" ||
      viewer.role === "ceo" ||
      viewer.role === "finance_staff";
    if (!allowed) {
      throw new Error(
        "Only Head Office or Finance staff can edit a contract. Ask your branch manager to request the change."
      );
    }

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    // Branch staff in the allowed roles may still only touch their own branch.
    await assertCanAccessRecord(ctx, contract.branchId);

    if (args.planAmount < 0 || args.monthlyAmortization < 0) {
      throw new Error("Plan value and monthly amortization cannot be negative.");
    }
    if (!args.contractNumber.trim()) {
      throw new Error("The plan number (LPA / EFS control no.) is required.");
    }
    // Guard against two plans landing on the same control number.
    const duplicate = await ctx.db
      .query("contracts")
      .withIndex("by_client", (q) => q.eq("clientId", contract.clientId))
      .collect()
      .then((rows) =>
        rows.find(
          (r) =>
            String(r._id) !== String(args.contractId) &&
            r.contractNumber.trim().toLowerCase() ===
              args.contractNumber.trim().toLowerCase()
        )
      );
    if (duplicate) {
      throw new Error(
        `Another plan for this planholder already uses number "${args.contractNumber.trim()}".`
      );
    }

    const contractNumber = args.contractNumber.trim();
    const changes: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const fieldLabels: Record<string, string> = {
      contractNumber: "Plan number",
      planType: "Plan type",
      planAmount: "Plan value",
      monthlyAmortization: "Monthly amortization",
      startDate: "Effectivity date",
      maturityDate: "Maturity date",
      contractStatus: "Status",
    };

    for (const [key, label] of Object.entries(fieldLabels)) {
      const next = args[key as keyof typeof args];
      const prev = contract[key as keyof typeof contract];
      // Dates are stored as ms timestamps; the edit form rounds to the day, so
      // compare calendar dates rather than exact millis.
      const isDate = key === "startDate" || key === "maturityDate";
      const changed = isDate
        ? dayStart(next as number | undefined) !== dayStart(prev as number | undefined)
        : String(next) !== String(prev);
      if (changed) {
        before[key] = prev;
        changes[key] = next;
      }
    }

    if (Object.keys(changes).length > 0) {
      await ctx.db.patch(args.contractId, changes as Partial<typeof contract>);

      // Effectivity drives every due date; keep stored schedules in step when
      // it moves (schedule rows are derived from the same rule on screen).
      if (changes.startDate !== undefined) {
        const schedules = await ctx.db
          .query("payment_schedules")
          .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
          .collect();
        const start = new Date(contract.startDate);
        const day = start.getDate();
        for (const [i, s] of schedules.entries()) {
          const monthIndex = start.getMonth() + (i + 1);
          const year = start.getFullYear() + Math.floor(monthIndex / 12);
          const month = ((monthIndex % 12) + 12) % 12;
          const lastDay = new Date(year, month + 1, 0).getDate();
          await ctx.db.patch(s._id, {
            dueDate: new Date(year, month, Math.min(day, lastDay)).getTime(),
          });
        }
      }

      const user = await ctx.db.get(userId);
      const summary = Object.keys(changes)
        .map((k) => `${fieldLabels[k]} → ${formatChange(changes[k], before[k])}`)
        .join(", ");
      await ctx.db.insert("audit_log", {
        action: "update",
        entityType: "contract",
        entityId: args.contractId,
        userId,
        userName: user?.name || user?.email || "Unknown",
        description: `Contract ${contract.contractNumber} updated — ${summary}`,
        oldValues: before,
        newValues: changes,
        timestamp: Date.now(),
      });
    }

    return { updated: Object.keys(changes).length };
  },
});

/** Midnight timestamp for comparing calendar dates. */
function dayStart(ts: number | undefined): number | undefined {
  if (ts === undefined || Number.isNaN(ts)) return undefined;
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Human-readable before → after for the audit trail. */
function formatChange(next: unknown, prev: unknown): string {
  const isMoney =
    typeof next === "number" &&
    (String(next).length > 0 && (next > 1000 || Number.isInteger(next) === false));
  const render = (v: unknown) => {
    if (v === undefined || v === null) return "—";
    if (typeof v === "number" && (isMoney || v > 1000)) return formatPHP(v);
    if (typeof v === "number") return String(v);
    return String(v);
  };
  return `${render(prev)} → ${render(next)}`;
}

/**
 * Update a contract's status.
 */
export const updateStatus = mutation({
  args: {
    contractId: v.id("contracts"),
    contractStatus: contractStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const oldContract = await ctx.db.get(args.contractId);
    if (!oldContract) throw new Error("Contract not found");
    await assertCanAccessRecord(ctx, oldContract.branchId);
    const oldStatus = oldContract?.contractStatus;

    await ctx.db.patch(args.contractId, {
      contractStatus: args.contractStatus,
    });

    // Log audit entry
    if (oldStatus && oldStatus !== args.contractStatus) {
      const user = await ctx.db.get(userId);
      await ctx.db.insert("audit_log", {
        action: "status_change",
        entityType: "contract",
        entityId: args.contractId,
        userId,
        userName: user?.name || user?.email || "Unknown",
        description: `Contract status changed from "${oldStatus}" to "${args.contractStatus}"`,
        oldValues: { contractStatus: oldStatus },
        newValues: { contractStatus: args.contractStatus },
        timestamp: Date.now(),
      });
    }
  },
});
