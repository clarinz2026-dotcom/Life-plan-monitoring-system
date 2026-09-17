import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ─── Roles ──────────────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  CEO: "ceo",
  FINANCE_STAFF: "finance_staff",
  CASHIER: "cashier",
  MANAGER: "manager",
} as const;

export const roleValidator = v.union(
  v.literal("super_admin"),
  v.literal("ceo"),
  v.literal("finance_staff"),
  v.literal("cashier"),
  v.literal("manager"),
);

export const POSITION_LABELS: Record<string, string> = {
  branch_manager: "Branch Manager",
  collector: "Collector",
  cashier: "Cashier",
};

const positionValidator = v.union(
  v.literal("branch_manager"),
  v.literal("collector"),
  v.literal("cashier"),
);

// ─── Enum values ────────────────────────────────────────────────────────────
export const CONTRACT_STATUSES = [
  "current",
  "delinquent_30",
  "delinquent_60",
  "delinquent_90",
  "lapsed",
  "fully_paid",
] as const;

export const PAYMENT_CHANNELS = [
  "cash",
  "gcash",
  "maya",
  "bank_transfer",
  "check",
] as const;

export const OR_STATUSES = ["active", "exhausted", "cancelled"] as const;

// ─── Validators ─────────────────────────────────────────────────────────────
const contractStatusValidator = v.union(
  v.literal("current"),
  v.literal("delinquent_30"),
  v.literal("delinquent_60"),
  v.literal("delinquent_90"),
  v.literal("lapsed"),
  v.literal("fully_paid"),
);

const paymentChannelValidator = v.union(
  v.literal("cash"),
  v.literal("gcash"),
  v.literal("maya"),
  v.literal("bank_transfer"),
  v.literal("check"),
);

const orStatusValidator = v.union(
  v.literal("active"),
  v.literal("exhausted"),
  v.literal("cancelled"),
);

// ─── Schema ─────────────────────────────────────────────────────────────────
const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      branchId: v.optional(v.id("branches")),
      position: v.optional(positionValidator),
      // Mobile number for staff SMS blasts (reminders, schedule changes).
      // Optional and never used for auth — email remains the login identity.
      phoneNumber: v.optional(v.string()),
    })
      .index("email", ["email"])
      .index("by_role", ["role"])
      .index("by_branch", ["branchId"]),

    // Clients / planholders
    clients: defineTable({
      firstName: v.string(),
      lastName: v.string(),
      middleName: v.optional(v.string()),
      dateOfBirth: v.number(),
      gender: v.union(v.literal("male"), v.literal("female"), v.literal("other")),
      contactNumber: v.string(),
      email: v.optional(v.string()),
      address: v.string(),
      city: v.string(),
      province: v.string(),
      zipCode: v.string(),
      occupation: v.optional(v.string()),
      beneficiaryName: v.string(),
      beneficiaryRelationship: v.string(),
      beneficiaryContact: v.optional(v.string()),
      // Up to 4 beneficiaries — falls back to single beneficiary fields above
      // when this array is empty or absent (backward-compatible).
      beneficiaries: v.optional(
        v.array(
          v.object({
            name: v.string(),
            age: v.optional(v.number()),
            relationship: v.string(),
          })
        )
      ),
      notes: v.optional(v.string()),
      branchId: v.optional(v.id("branches")),
      // Soft delete. Business and financial history is never hard-deleted: a
      // removed planholder is archived, hidden from the working lists, and can
      // be restored (see clients.archive).
      archivedAt: v.optional(v.number()),
      archivedBy: v.optional(v.id("users")),
      archiveReason: v.optional(v.string()),
      createdAt: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_lastName", ["lastName"])
      .index("by_createdAt", ["createdAt"])
      .index("by_email", ["email"])
      .index("by_branch", ["branchId"])
      // Branch-scoped working list (excludes archived rows in the query).
      .index("by_branch_archivedAt", ["branchId", "archivedAt"])
      .index("by_archivedAt", ["archivedAt"]),

    // Contracts / plans
    contracts: defineTable({
      clientId: v.id("clients"),
      contractNumber: v.string(),
      planType: v.string(),
      planAmount: v.number(),
      monthlyAmortization: v.number(),
      totalPaid: v.number(),
      contractStatus: contractStatusValidator,
      startDate: v.number(),
      maturityDate: v.optional(v.number()),
      assignedAgent: v.optional(v.id("users")),
      branchId: v.optional(v.id("branches")),
      createdAt: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_client", ["clientId"])
      .index("by_status", ["contractStatus"])
      .index("by_contractNumber", ["contractNumber"])
      .index("by_branch", ["branchId"])
      // Branch-scoped status lookups (dashboard "needs attention" list).
      .index("by_branch_status", ["branchId", "contractStatus"]),

    // Plan catalog (e.g. Isidore, Gabriel, Raphael, Michael).
    // price = current MONTHLY amortization; oldPrice = legacy monthly rate
    // for clients still paying old prices. Full plan price = monthly x 60.
    plans: defineTable({
      name: v.string(),
      price: v.number(), // current monthly price (₱)
      oldPrice: v.optional(v.number()), // old monthly price (₱)
      monthlyRate: v.optional(v.number()), // legacy alias (deprecated)
      isActive: v.boolean(),
      createdAt: v.number(),
      createdBy: v.id("users"),
    }).index("by_name", ["name"]),

    // Payments
    payments: defineTable({
      contractId: v.id("contracts"),
      clientId: v.id("clients"),
      amount: v.number(),
      paymentChannel: paymentChannelValidator,
      paymentDate: v.number(),
      orNumber: v.optional(v.string()),
      referenceNumber: v.optional(v.string()),
      chequeNumber: v.optional(v.string()),
      bankName: v.optional(v.string()),
      remarks: v.optional(v.string()),
      branchId: v.optional(v.id("branches")),
      recordedBy: v.id("users"),
      // Reversal (soft delete). A payment is never silently dropped from the
      // ledger: it is archived, the amount comes off the plan's total, and the
      // row can be restored (see payments.archive / payments.restore).
      archivedAt: v.optional(v.number()),
      archivedBy: v.optional(v.id("users")),
      archiveReason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_contract", ["contractId"])
      .index("by_client", ["clientId"])
      .index("by_paymentDate", ["paymentDate"])
      .index("by_orNumber", ["orNumber"])
      .index("by_branch", ["branchId"])
      // Newest payment for a contract without reading the whole history.
      .index("by_contract_paymentDate", ["contractId", "paymentDate"]),

    // Audit log
    audit_log: defineTable({
      action: v.union(
        v.literal("create"),
        v.literal("update"),
        v.literal("delete"),
        v.literal("status_change"),
      ),
      entityType: v.union(
        v.literal("client"),
        v.literal("contract"),
        v.literal("payment"),
        v.literal("receipt"),
      ),
      entityId: v.string(),
      userId: v.id("users"),
      userName: v.optional(v.string()),
      description: v.string(),
      oldValues: v.optional(v.any()),
      newValues: v.optional(v.any()),
      // Branch the action happened under, so the trail can be filtered per
      // branch for branch staff and sliced per branch by Head Office.
      branchId: v.optional(v.id("branches")),
      timestamp: v.number(),
    })
      .index("by_entity", ["entityType", "entityId"])
      .index("by_user", ["userId"])
      .index("by_timestamp", ["timestamp"])
      .index("by_action", ["action"])
      .index("by_branch", ["branchId"]),

    // Receipts
    receipts: defineTable({
      paymentId: v.id("payments"),
      contractId: v.id("contracts"),
      clientId: v.id("clients"),
      receiptNumber: v.string(),
      amount: v.number(),
      paymentChannel: paymentChannelValidator,
      paymentDate: v.number(),
      issuedTo: v.string(),
      planType: v.string(),
      contractNumber: v.string(),
      status: orStatusValidator,
      issuedBy: v.id("users"),
      branchId: v.optional(v.id("branches")),
      createdAt: v.number(),
    })
      .index("by_payment", ["paymentId"])
      .index("by_client", ["clientId"])
      .index("by_receiptNumber", ["receiptNumber"])
      .index("by_createdAt", ["createdAt"])
      .index("by_branch", ["branchId"]),

    // ─── NEW: Payment Schedules (due dates) ──────────────────────────────
    payment_schedules: defineTable({
      contractId: v.id("contracts"),
      clientId: v.id("clients"),
      dueDate: v.number(),
      amount: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("overdue"),
        v.literal("waived"),
      ),
      paidPaymentId: v.optional(v.id("payments")),
      reminderSent: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_contract", ["contractId"])
      .index("by_client", ["clientId"])
      .index("by_dueDate", ["dueDate"])
      .index("by_status", ["status"]),

    // ─── NEW: Daily Reconciliation ───────────────────────────────────────
    daily_reconciliation: defineTable({
      cashierId: v.id("users"),
      reconciliationDate: v.number(),
      totalCash: v.number(),
      totalGCash: v.number(),
      totalMaya: v.number(),
      totalBankTransfer: v.number(),
      totalCheck: v.number(),
      totalRecorded: v.number(), // sum of all payment records
      totalActual: v.number(), // what cashier physically counted
      variance: v.number(), // actual - recorded
      status: v.union(
        v.literal("open"),
        v.literal("closed"),
        v.literal("reviewed"),
      ),
      notes: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      // Branch whose collections were counted (branch staff are forced to
      // their own; Head Office can filter reconciliations per branch).
      branchId: v.optional(v.id("branches")),
      createdAt: v.number(),
    })
      .index("by_cashier", ["cashierId"])
      .index("by_date", ["reconciliationDate"])
      .index("by_status", ["status"])
      .index("by_branch", ["branchId"]),

    // ─── NEW: Notifications ──────────────────────────────────────────────
    notifications: defineTable({
      userId: v.id("users"),
      clientId: v.optional(v.id("clients")),
      type: v.union(
        v.literal("payment_reminder"),
        v.literal("delinquency_alert"),
        v.literal("claim_update"),
        v.literal("system"),
      ),
      title: v.string(),
      message: v.string(),
      channel: v.union(
        v.literal("sms"),
        v.literal("email"),
        v.literal("in_app"),
      ),
      status: v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("read"),
      ),
      scheduledAt: v.number(),
      sentAt: v.optional(v.number()),
      readAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_client", ["clientId"])
      .index("by_status", ["status"])
      .index("by_scheduledAt", ["scheduledAt"]),

    // ─── System Settings (locked config) ───────────────────────────────
    system_settings: defineTable({
      key: v.string(), // e.g. "super_admin_email"
      value: v.string(),
      lockedAt: v.number(),
      lockedBy: v.id("users"),
    }).index("by_key", ["key"]),

    // ─── NEW: Branches ───────────────────────────────────────────────────
    // One row per operating branch. This is the ONLY place a branch is defined:
    // creating a branch inserts a document, it never clones the application.
    // Global settings (company name, logo, plan catalog, security) live in
    // system_settings; branch settings (address, contact, hours, receipt
    // prefix, manager) live here.
    branches: defineTable({
      name: v.string(),
      code: v.string(),
      address: v.string(),
      city: v.string(),
      province: v.string(),
      contactNumber: v.optional(v.string()),
      email: v.optional(v.string()),
      // Branch-level settings.
      operatingHours: v.optional(v.string()),
      receiptPrefix: v.optional(v.string()),
      openingDate: v.optional(v.number()),
      managerId: v.optional(v.id("users")),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index("by_code", ["code"])
      .index("by_isActive", ["isActive"]),

    // ─── NEW: Branch transfer history ────────────────────────────────────
    // One row per client moved between branches. Payments are never rewritten
    // by a transfer, so the financial history stays under the branch that
    // actually recorded it; this table is the audit trail of the move.
    branch_transfer_history: defineTable({
      clientId: v.id("clients"),
      fromBranchId: v.optional(v.id("branches")),
      toBranchId: v.id("branches"),
      reason: v.optional(v.string()),
      movedContracts: v.number(),
      movedReceipts: v.number(),
      retainedPayments: v.number(),
      requestedBy: v.id("users"),
      requestedByName: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_client", ["clientId"])
      .index("by_to_branch", ["toBranchId"])
      .index("by_createdAt", ["createdAt"]),

    // ─── Client portal: service requests ────────────────────────────────
    service_requests: defineTable({
      userId: v.id("users"),
      serviceType: v.string(),
      branchId: v.optional(v.id("branches")),
      contactName: v.string(),
      contactNumber: v.string(),
      contactEmail: v.optional(v.string()),
      preferredDate: v.optional(v.number()),
      message: v.optional(v.string()),
      status: v.union(
        v.literal("submitted"),
        v.literal("under_review"),
        v.literal("scheduled"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      staffNotes: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_createdAt", ["createdAt"])
      .index("by_branch", ["branchId"]),

    // Outbound SMS log. One row per recipient per send — a bulk send to a
    // selection creates one row each, so failures are attributable and the
    // history answers "did they get the reminder?" without leaving the app.
    sms_messages: defineTable({
      to: v.string(), // E.164 (+639…)
      recipientName: v.optional(v.string()),
      // "client" or "staff" — keeps the client/staff histories separable.
      recipientType: v.union(v.literal("client"), v.literal("staff")),
      clientId: v.optional(v.id("clients")),
      staffUserId: v.optional(v.id("users")),
      body: v.string(),
      status: v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("failed"),
      ),
      providerSid: v.optional(v.string()), // Twilio message SID when sent
      errorMessage: v.optional(v.string()),
      branchId: v.optional(v.id("branches")),
      sentBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_createdAt", ["createdAt"])
      .index("by_sentBy", ["sentBy"])
      .index("by_branch", ["branchId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
