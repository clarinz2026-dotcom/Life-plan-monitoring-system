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
  "assigned_death_claim",
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
  v.literal("assigned_death_claim"),
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
      notes: v.optional(v.string()),
      branchId: v.optional(v.id("branches")),
      createdAt: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_lastName", ["lastName"])
      .index("by_createdAt", ["createdAt"])
      .index("by_email", ["email"])
      .index("by_branch", ["branchId"]),

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
      timestamp: v.number(),
    })
      .index("by_entity", ["entityType", "entityId"])
      .index("by_user", ["userId"])
      .index("by_timestamp", ["timestamp"])
      .index("by_action", ["action"]),

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
      createdAt: v.number(),
    })
      .index("by_cashier", ["cashierId"])
      .index("by_date", ["reconciliationDate"])
      .index("by_status", ["status"]),

    // ─── NEW: Death Claims ───────────────────────────────────────────────
    death_claims: defineTable({
      contractId: v.id("contracts"),
      clientId: v.id("clients"),
      claimantName: v.string(),
      claimantRelationship: v.string(),
      claimantContact: v.string(),
      claimantAddress: v.optional(v.string()),
      dateOfDeath: v.number(),
      deathCertificateNo: v.optional(v.string()),
      causeOfDeath: v.optional(v.string()),
      documentsRequired: v.array(v.string()), // list of required docs
      documentsSubmitted: v.array(v.string()), // list of submitted docs
      status: v.union(
        v.literal("filed"),
        v.literal("under_review"),
        v.literal("documents_incomplete"),
        v.literal("documents_complete"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("payout_pending"),
        v.literal("payout_completed"),
      ),
      payoutAmount: v.number(),
      payoutDate: v.optional(v.number()),
      processedBy: v.optional(v.id("users")),
      reviewedBy: v.optional(v.id("users")),
      notes: v.optional(v.string()),
      filedBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_contract", ["contractId"])
      .index("by_client", ["clientId"])
      .index("by_status", ["status"]),

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
    branches: defineTable({
      name: v.string(),
      code: v.string(),
      address: v.string(),
      city: v.string(),
      province: v.string(),
      contactNumber: v.optional(v.string()),
      managerId: v.optional(v.id("users")),
      isActive: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_code", ["code"]),

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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
