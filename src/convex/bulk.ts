import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, MutationCtx } from "./_generated/server";
import {
  PLAN_TERM_MONTHS,
  fullPlanPrice,
  resolveMonthlyPrice,
} from "./plans";
import { getViewer, isAdminRole } from "./access";

/**
 * Bulk create clients (and optionally contracts) from parsed CSV/XLSX data.
 *
 * Expected template columns:
 *   No. | Planholder Name | LPA NO | Plan Type | Effectivity Date |
 *   Due Date | Installment | Amount | 30 | 60 | 90 | Contact No. | Address
 *
 * A client record is always created. When the Plan Type matches an active
 * plan on the Plans page (case-insensitive), a CONTRACT is created too:
 *   - contract number  = LPA NO (if present) else auto-generated
 *   - monthly rate     = Amount ÷ months paid when the sheet has an Amount,
 *                        else the per-row price chosen in the upload preview,
 *                        else the plan's monthly payment
 *   - plan amount      = monthly rate x 60 months (full plan price)
 *   - Installment      = months already paid → one backdated cash payment per
 *                        month, dated monthly from the effectivity date
 * Rows whose plan type does not match any plan are imported client-only.
 */
export const bulkCreateClients = mutation({
  args: {
    /**
     * Target branch for the imported records. Head Office may choose one (for
     * example "import this sheet into Branch 002"); branch staff may not, and
     * whatever they send is ignored in favour of their own branch.
     *
     * Without this, an import run by Head Office produced records with no
     * branch at all — and unassigned records are readable by every branch.
     */
    branchId: v.optional(v.id("branches")),
    clients: v.array(
      v.object({
        no: v.optional(v.string()),
        planholderName: v.optional(v.string()),
        lpaNo: v.optional(v.string()),
        planType: v.optional(v.string()),
        effectivityDate: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        installment: v.optional(v.string()),
        amount: v.optional(v.string()),
        due30: v.optional(v.string()),
        due60: v.optional(v.string()),
        due90: v.optional(v.string()),
        contactNumber: v.optional(v.string()),
        address: v.optional(v.string()),
        // Chosen monthly rate for this client (plan old/current price pick).
        selectedPrice: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const viewer = await getViewer(ctx);
    if (!viewer) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const userName = user?.name || user?.email || "Unknown";
    // Branch always comes from the authenticated account; Head Office may pick
    // one explicitly. Never from an unauthenticated or branch-supplied value.
    const branchId = isAdminRole(viewer.role)
      ? args.branchId ?? user?.branchId
      : user?.branchId;

    const results = {
      success: 0,
      failed: 0,
      contractsCreated: 0,
      paymentsCreated: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    for (let i = 0; i < args.clients.length; i++) {
      const row = args.clients[i];
      try {
        const planholderName = (row.planholderName || "").trim();
        const contactNumber = (row.contactNumber || "").trim();
        const address = (row.address || "").trim();

        if (!planholderName) {
          throw new Error("Planholder name is required");
        }

        const { firstName, lastName, middleName } = splitFullName(planholderName);

        // Clients table requires a DOB; bulk sheets don't carry one, so store a
        // neutral placeholder (can be corrected later in the client profile).
        const clientId = await ctx.db.insert("clients", {
          firstName,
          lastName,
          middleName,
          dateOfBirth: new Date("1990-01-01").getTime(),
          gender: "other",
          contactNumber: contactNumber || "",
          email: undefined,
          address: address || "",
          city: "",
          province: "",
          zipCode: "",
          occupation: undefined,
          beneficiaryName: "TBD",
          beneficiaryRelationship: "TBD",
          beneficiaryContact: undefined,
          notes: buildReferenceNotes(row) || undefined,
          branchId,
          createdAt: Date.now(),
          createdBy: userId,
        });

        await ctx.db.insert("audit_log", {
          action: "create",
          entityType: "client",
          entityId: clientId,
          userId,
          userName,
          description: `Client ${firstName} ${lastName} created via bulk upload`,
          newValues: {
            firstName,
            lastName,
            contactNumber: contactNumber || "",
            address: address || "",
          },
          branchId,
          timestamp: Date.now(),
        });

  // Auto-create contract + backdated payments when the plan type matches.
  const planType = (row.planType || "").trim();
  if (planType) {
    const plan = await findActivePlanByName(ctx, planType);
    if (plan) {
      try {
        const contractInfo = await createContractWithBackdatedPayments(ctx, {
          clientId,
          userId,
          userName,
          branchId,
          row,
          plan,
          rowIndex: i,
        });
        results.contractsCreated++;
        results.paymentsCreated += contractInfo.paymentsCreated;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: `Client created, but contract failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    }
  }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    await ctx.db.insert("audit_log", {
      action: "create",
      entityType: "client",
      entityId: "bulk-upload",
      userId,
      userName,
      description: `Bulk upload completed: ${results.success} clients, ${results.contractsCreated} contracts, ${results.paymentsCreated} backdated payments; ${results.failed} failed`,
      newValues: {
        totalRows: args.clients.length,
        success: results.success,
        contractsCreated: results.contractsCreated,
        paymentsCreated: results.paymentsCreated,
        failed: results.failed,
        errors: results.errors,
      },
      timestamp: Date.now(),
    });

    return results;
  },
});

async function createContractWithBackdatedPayments(
  ctx: MutationCtx,
  opts: {
    clientId: Id<"clients">;
    userId: Id<"users">;
    userName: string;
    branchId?: Id<"branches">;
    row: {
      lpaNo?: string;
      effectivityDate?: string;
      installment?: string;
      amount?: string;
      selectedPrice?: number;
    };
    plan: { name: string; price: number; monthlyRate?: number };
    rowIndex: number;
  },
) {
  const monthsPaid = parseInt(opts.row.installment || "", 10) || 0;
  const monthly = resolveRowMonthly(opts.row, opts.plan);
  const startDate = parseDate(opts.row.effectivityDate) ?? Date.now();
  const contractNumber = (opts.row.lpaNo || "").trim() || generateContractNumber(opts.rowIndex);

  const contractId = await ctx.db.insert("contracts", {
    clientId: opts.clientId,
    contractNumber,
    planType: opts.plan.name,
    planAmount: fullPlanPrice(monthly),
    monthlyAmortization: monthly,
    totalPaid: monthly * monthsPaid,
    contractStatus: "current",
    startDate,
    maturityDate: addMonths(startDate, PLAN_TERM_MONTHS),
    assignedAgent: undefined,
    branchId: opts.branchId,
    createdAt: Date.now(),
    createdBy: opts.userId,
  });

  // One backdated cash payment per month already paid, dated from effectivity.
  let paymentsCreated = 0;
  for (let m = 0; m < monthsPaid; m++) {
    await ctx.db.insert("payments", {
      contractId,
      clientId: opts.clientId,
      amount: monthly,
      paymentChannel: "cash",
      paymentDate: addMonths(startDate, m),
      orNumber: undefined,
      referenceNumber: undefined,
      chequeNumber: undefined,
      bankName: undefined,
      remarks: "Backdated (bulk import)",
      branchId: opts.branchId,
      recordedBy: opts.userId,
      createdAt: Date.now(),
    });
    paymentsCreated++;
  }

  await ctx.db.insert("audit_log", {
    action: "create",
    entityType: "contract",
    entityId: contractId,
    userId: opts.userId,
    userName: opts.userName,
    description: `Contract ${contractNumber} auto-created for plan "${opts.plan.name}" (₱${monthly.toLocaleString()}/mo, ${monthsPaid} backdated month${monthsPaid !== 1 ? "s" : ""}) via bulk upload`,
    branchId: opts.branchId,
    newValues: {
      contractNumber,
      planType: opts.plan.name,
      monthlyRate: monthly,
      monthsPaid,
      startDate,
    },
    timestamp: Date.now(),
  });

  return { contractId, paymentsCreated };
}

/**
 * The monthly payment to bill a bulk-imported row when auto-creating its
 * contract:
 *  1. Spreadsheet Amount ÷ months paid (the client's actual rate)
 *  2. The per-row override chosen in the upload preview
 *  3. The plan's monthly payment
 */
function resolveRowMonthly(
  row: { installment?: string; amount?: string; selectedPrice?: number },
  plan: { price: number; monthlyRate?: number },
): number {
  const monthsPaid = parseInt(row.installment || "", 10) || 0;
  const amount = parseFloat(String(row.amount ?? "").replace(/,/g, ""));
  if (monthsPaid > 0 && !isNaN(amount) && amount > 0) {
    const derived = Math.round(amount / monthsPaid);
    if (derived > 0) return derived;
  }
  if (row.selectedPrice && row.selectedPrice > 0) {
    return Math.round(row.selectedPrice);
  }
  return resolveMonthlyPrice(plan);
}

/** Find an active plan by name, case-insensitive. */
async function findActivePlanByName(ctx: { db: MutationCtx["db"] }, name: string) {
  const plans = await ctx.db.query("plans").collect();
  return (
    plans.find(
      (p) =>
        p.isActive !== false &&
        p.name.toLowerCase().trim() === name.toLowerCase().trim(),
    ) ?? null
  );
}

/** Split "Juan Dela Cruz", "Juan B. Dela Cruz", or "Dela Cruz, Juan" into parts. */
function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
  middleName?: string;
} {
  if (fullName.includes(",")) {
    // "Last Name, First Middle"
    const [surnamePart, givenPart] = fullName.split(",", 2);
    const lastName = (surnamePart || "").trim() || "Unknown";
    const given = (givenPart || "").trim().split(/\s+/).filter(Boolean);
    const firstName = given.shift() || "Unknown";
    return {
      firstName,
      lastName,
      middleName: given.length > 0 ? given.join(" ") : undefined,
    };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Unknown";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : firstName;
  return {
    firstName,
    lastName,
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined,
  };
}

/** Keep all reference-only columns (due date, months paid, amounts, aging) in one string. */
function buildReferenceNotes(row: {
  no?: string;
  lpaNo?: string;
  planType?: string;
  effectivityDate?: string;
  dueDate?: string;
  installment?: string;
  amount?: string;
  due30?: string;
  due60?: string;
  due90?: string;
}): string | null {
  const refs: Array<[string, string | undefined]> = [
    ["No.", row.no],
    ["LPA NO", row.lpaNo],
    ["Plan Type", row.planType],
    ["Effectivity Date", row.effectivityDate],
    ["Due Date", row.dueDate],
    ["Months Paid", row.installment],
    ["Amount", row.amount],
    ["30", row.due30],
    ["60", row.due60],
    ["90", row.due90],
  ];

  const parts = refs
    .filter(([, value]) => value !== undefined && String(value).trim() !== "")
    .map(([label, value]) => `${label}: ${String(value).trim()}`);

  return parts.length > 0 ? parts.join(" | ") : null;
}

/** Parse MM/DD/YYYY, DD/MM/YYYY (ambiguous → MM/DD first), or ISO strings. */
function parseDate(value?: string): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = Date.parse(raw);
  if (!isNaN(iso)) return iso;

  const m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, a, b, yearRaw] = m;
    const year = yearRaw.length === 2 ? 2000 + parseInt(yearRaw, 10) : parseInt(yearRaw, 10);
    const first = new Date(year, parseInt(a, 10) - 1, parseInt(b, 10)).getTime();
    if (!isNaN(first)) return first; // MM/DD/YYYY
    const second = new Date(year, parseInt(b, 10) - 1, parseInt(a, 10)).getTime();
    if (!isNaN(second)) return second; // DD/MM/YYYY
  }
  return null;
}

function addMonths(timestamp: number, months: number): number {
  const d = new Date(timestamp);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

/** Auto-generated contract number: EFS-YYYYMMDD-NNN. */
function generateContractNumber(rowIndex: number): string {
  const d = new Date();
  const ymd =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;
  const seq = String(rowIndex + 1).padStart(3, "0");
  return `EFS-${ymd}-${seq}`;
}