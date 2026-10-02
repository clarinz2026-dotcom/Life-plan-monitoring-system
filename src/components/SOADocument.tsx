import { format } from "date-fns";

export interface SOABeneficiary {
  name: string;
  age?: number;
  relationship: string;
}

export interface SOAData {
  /** Planholder full display name. */
  clientName: string;
  clientAddress: string;
  clientContact: string;
  clientEmail?: string;
  /** Computed age from DOB. */
  clientAge?: number;
  /** Pre-formatted birth date. */
  clientBirthDate?: string;
  /** Beneficiaries — up to 4. Falls back to single beneficiary fields. */
  beneficiaries: SOABeneficiary[];
  /** Branch shown on the statement. */
  branchName?: string;
  /** Sales agent name (resolved from users table). */
  salesAgent?: string;
  /** Company logo URL. */
  logoUrl?: string;
  contracts: Array<{
    contractNumber: string;
    planType: string;
    planAmount: number;
    monthlyAmortization: number;
    totalPaid: number;
    contractStatus: string;
    startDate: number;
  }>;
  payments: Array<{
    paymentDate: number;
    amount: number;
    paymentChannel: string;
    orNumber?: string;
    contractNumber: string;
    remarks?: string;
  }>;
  generatedDate: string;
  accountNumber: string;
}

/**
 * The printed statement uses the same three payment statuses as the portal, so
 * a family reading the PDF sees the same wording as the screen.
 */
const STATUS_LABELS: Record<string, string> = {
  current: "Good Payer",
  fully_paid: "Good Payer",
  reinstated: "Reinstated",
  delinquent_30: "Lapsed",
  delinquent_60: "Lapsed",
  delinquent_90: "Lapsed",
  lapsed: "Lapsed",
};

const CHANNEL_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  check: "Check",
};

/** `#,##0.00` — the money format on the statement. */
function fmtMoney(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** `PHP #,##0.00` — the money format the office's template prints. */
function php(amount: number) {
  return `PHP ${fmtMoney(amount)}`;
}

/** `MM/DD/YYYY` — the date format on the statement. */
function fmtDateShort(ts: number) {
  return format(new Date(ts), "MM/dd/yyyy");
}

const MS_PER_DAY = 86_400_000;

/**
 * Due date of the nth installment (1-based).
 *
 * Mirrors the rule in `paymentSchedules.generate`: the installment falls due on
 * the SAME day of the month as the plan's start date (its effectivity date), n
 * months later — a plan effective Aug 22 has its first installment due Sep 22,
 * the second Oct 22, and so on. Derivation is necessary because
 * `payment_schedules` holds no rows — nothing is stored that could simply be
 * read.
 *
 * Days are clamped to the end of the target month, so a plan effective on the
 * 31st has its February installment land on the 28th/29th rather than spilling
 * into March.
 */
export function installmentDueDate(
  startDate: number,
  installment: number
): number | null {
  if (!Number.isFinite(startDate) || installment < 1) return null;
  const start = new Date(startDate);
  const day = start.getDate();
  const monthIndex = start.getMonth() + installment;
  const year = start.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  // Day 0 of the following month is the last day of the target month.
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay)).getTime();
}

/**
 * Pay Class shown in the Payment History table.
 *
 * Late payments are reported in the office's 30-day delinquency brackets
 * rather than as a raw day count:
 *
 *  - paid BEFORE the due date → "Advanced"
 *  - 0–30 days late           → "30"
 *  - 31–60 days late          → "60"
 *  - 61–90 days late          → "90"
 *  - past 90 days late        → "Lapsed"
 *
 * A planholder paying ahead of schedule is common — several installments are
 * settled in one sitting — so those rows read "Advanced" instead of late.
 * Change the constants below if those brackets should ever differ.
 */
const ADVANCE_AGING_LABEL = "Advanced";
const LAPSED_AGING_LABEL = "Lapsed";
/** Upper bound of each delinquency bracket, in days late. */
const AGING_BRACKETS = [30, 60, 90];

export function agingCell(
  dueDate: number | null,
  paymentDate: number
): string {
  // No due date means the contract has no usable start date; show a dash
  // rather than inventing a figure.
  if (dueDate === null) return "—";
  const daysLate = Math.floor((paymentDate - dueDate) / MS_PER_DAY);
  if (daysLate < 0) return ADVANCE_AGING_LABEL;
  for (const bound of AGING_BRACKETS) {
    if (daysLate <= bound) return String(bound);
  }
  return LAPSED_AGING_LABEL;
}

/**
 * True when the planholder has settled more installments than have actually
 * fallen due — i.e. they are paying ahead of schedule and the plan's payment
 * status reads "Advanced" rather than the stored contract status.
 *
 * Shared by the portal pill and the printed statement so both always agree.
 */
export function isAdvancedStatus(
  startDate: number,
  paymentCount: number,
  now: number
): boolean {
  if (paymentCount < 1) return false;
  let fallenDue = 0;
  for (let i = 1; i <= paymentCount; i++) {
    const due = installmentDueDate(startDate, i);
    if (due !== null && due <= now) fallenDue++;
  }
  return paymentCount > fallenDue;
}

/** Matches an email address anywhere in a free-text string. */
const EMAIL_TOKEN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/**
 * Splits a stored address into the street address and the email address.
 *
 * Clients are often entered with the email typed into the address line (e.g.
 * "dclarinz2026@gmail.com, Malaybalay City, Bukidnon"). Pulling the email out
 * here lets every view — the portal, the staff page and the printed statement —
 * show the address and the email on their own lines instead of one run-on
 * line. The record's own email field wins when it is filled in.
 */
export function splitAddressEmail(
  address: string,
  email?: string | null
): { address: string; email: string } {
  const parts = (address || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const found = parts.find((p) => EMAIL_TOKEN.test(p));
  const rest = parts.filter((p) => p !== found);
  return {
    address: rest.join(", ") || "—",
    email: (email || found || "").trim(),
  };
}

/** Escape user-entered text before it lands in the generated HTML. */
function esc(value: string | number | undefined | null) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Company line printed under the letterhead, per the office's template. */
const COMPANY_ADDRESS =
  "Evangelist Life Insurance Services | 2nd Floor, Gabinez Bldg., Fortich St., Malaybalay City, Bukidnon, 8700";

/**
 * One document stylesheet, shared by the PDF render and the on-screen preview
 * (`SOAButton` renders the same HTML into an iframe), so what a family sees in
 * the viewer is exactly what they download.
 *
 * The layout follows the office's statement template: a centered letterhead
 * with the company name and address, a centered STATEMENT OF ACCOUNT title,
 * then full-width brand-green section bars over a two-column ruled-field
 * Account Information grid, the ten-column Payment History table, and the
 * four-cell Account Summary strip with large figures at the foot.
 */
const SOA_STYLES = `
  @page { size: A4; margin: 6mm; }
  @font-face {
    font-family: "Brayles";
    src: url("/fonts/Brayles.ttf") format("truetype");
    font-style: normal;
    font-weight: 400;
    font-display: swap;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
    color: #211f1a;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  #soa {
    position: relative;
    width: 100%;
    max-width: 774px;
    margin: 0 auto;
    padding: 4px 0 4px;
    overflow: hidden;
  }

  /* html2canvas ignores <colgroup> entirely, so column widths are declared
     directly on the header cells. Every bordered table then spans the full
     content width in both the on-screen preview and the PDF. */
  /* Payment-history columns — the ten widths sum to exactly 100%, which
     table-layout: fixed requires to keep every column at its designed size
     (an over-100 total gets silently rescaled, and html2canvas rescales it
     again differently, which is what knocked the printed table out of line). */
  table.soa-grid th.wp1 { width: 10%; }  /* Payment Date */
  table.soa-grid th.wp2 { width: 8%; }   /* LPA Number */
  table.soa-grid th.wp3 { width: 10%; }  /* Effectivity Date */
  table.soa-grid th.wp4 { width: 10%; }  /* Due Date */
  table.soa-grid th.wp5 { width: 11%; }  /* Amount */
  table.soa-grid th.wp6 { width: 8%; }   /* Aging */
  table.soa-grid th.wp7 { width: 9%; }   /* Installment No. */
  table.soa-grid th.wp8 { width: 8%; }   /* O.R. No. */
  table.soa-grid th.wp9 { width: 13%; }  /* Balance */
  table.soa-grid th.wp10 { width: 13%; } /* Remarks */

  /* ── Letterhead ─────────────────────────────────────────────────────── */
  .lh { text-align: center; }
  .lh-logo {
    display: block;
    margin: 0 auto 4px;
    width: 46px;
    height: 46px;
    object-fit: contain;
  }
  .lh-brand {
    font-family: "Brayles", Georgia, serif;
    font-size: 30px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: 0.01em;
    color: #1d4ed8;
  }
  .lh-sub {
    margin-top: 3px;
    font-size: 9px;
    letter-spacing: 0.02em;
    color: #5c6b60;
  }

  /* ── Title ──────────────────────────────────────────────────────────── */
  .doc-title {
    margin: 14px 0 12px;
    text-align: center;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #1b4332;
  }

  /* ── Section bars ───────────────────────────────────────────────────── */
  .sec-bar {
    display: block;
    margin: 14px 0 8px;
    padding: 5px 12px 4px;
    background: #1b4332;
    color: #ffffff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* ── Ruled fields (Account Information) ─────────────────────────────── */
  table.fields { width: 100%; border-collapse: collapse; }
  table.fields td { vertical-align: bottom; padding: 5px 0 6px; }
  .fld-label {
    width: 1%;
    white-space: nowrap;
    padding-right: 6px !important;
    font-size: 9.5px;
    font-weight: 700;
    color: #211f1a;
  }
  .fld-value {
    border-bottom: 1px solid #8a958c;
    padding: 0 14px 2px 4px !important;
    font-size: 11.5px;
    font-weight: 700;
  }
  .fld-value.wide { padding-right: 26px !important; }
  .fld-value.narrow { padding-right: 6px !important; }

  /* ── Bordered tables (payment history) ──────────────────────────────── */
  /* The display is stated outright and the class is "soa-grid" on purpose. The
     PDF is produced by injecting this document into the live app page, where
     the app's Tailwind stylesheet is also in force: a generic class name like
     "grid" picks up the .grid { display: grid } utility there, which turns
     these tables into grid containers and collapses every column to its
     content — correct in the standalone preview, broken in the download. */
  table.soa-grid { display: table; width: 100% !important; border-collapse: collapse; table-layout: fixed; }
  table.soa-grid th, table.soa-grid td {
    border: 1px solid #a9b4ab;
    padding: 6px 5px;
    font-size: 11px;
    vertical-align: middle;
  }
  table.soa-grid thead th {
    background: #eef1ea;
    color: #1b4332;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.25;
    text-transform: uppercase;
    text-align: center;
    overflow-wrap: break-word;
  }
  table.soa-grid td.c { text-align: center; }
  table.soa-grid td.empty { text-align: center; font-style: italic; color: #6b7269; padding: 10px 7px; }

  /* ── Account summary strip ──────────────────────────────────────────── */
  .summary { display: flex; border: 1px solid #a9b4ab; background: #f1f4ef; }
  .summary .cell { flex: 1 1 0; padding: 10px 8px 12px; border-left: 1px solid #c6cfc6; }
  .summary .cell:first-child { border-left: none; }
  .summary .lbl {
    text-align: center;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #33413a;
  }
  .summary .val {
    margin-top: 8px;
    text-align: center;
    font-size: 19px;
    font-weight: 700;
    color: #1b4332;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ── Multi-plan statements ──────────────────────────────────────────── */
  .plan-block { page-break-inside: avoid; }
  .plan-block + .plan-block { margin-top: 10px; padding-top: 4px; border-top: 1px solid #d5dcd6; }
  .plan-heading {
    margin-top: 12px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #1b4332;
  }

  /* ── Footer ─────────────────────────────────────────────────────────── */
  .foot { margin-top: 20px; page-break-inside: avoid; }
  .foot-row { display: flex; align-items: center; gap: 14px; }
  .foot-rule { flex: 1 1 auto; height: 1px; background: #a9b4ab; }
  .foot-sign {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: 12.5px;
    color: #211f1a;
    white-space: nowrap;
  }
`;

export function generateSOAHTML(data: SOAData): string {
  const now = Date.now();
  /** A label sitting on the same ruled line as its value. */
  const fld = (label: string, value: string, valueClass = "") =>
    `<td class="fld-label">${esc(label)}</td><td class="fld-value ${valueClass}">${esc(value)}</td>`;

  // ── Plan blocks ────────────────────────────────────────────────────────
  const multiPlan = data.contracts.length > 1;

  const plansHTML = data.contracts
    .map((c, index) => {
      const contractPayments = data.payments
        .filter((p) => p.contractNumber === c.contractNumber)
        .sort((a, b) => a.paymentDate - b.paymentDate);

      let runningBalance = c.planAmount;
      let installmentCounter = 0;

      // The most recent payment's channel describes how the plan is being
      // settled; an unlabeled blank keeps the ruled line for the office to
      // fill in by hand.
      const latestPayment = contractPayments[contractPayments.length - 1];
      const latestChannel = latestPayment?.paymentChannel ?? "";
      const modeOfPayment =
        CHANNEL_LABELS[latestChannel] ?? latestChannel ?? "";

      // Plan value ÷ installment, expressed in whole years (2.5 when the
      // term lands on half a year).
      const termYears =
        c.monthlyAmortization > 0
          ? c.planAmount / c.monthlyAmortization / 12
          : NaN;
      const termLabel =
        Number.isFinite(termYears) && termYears > 0
          ? Number.isInteger(termYears)
            ? String(termYears)
            : termYears.toFixed(1)
          : "";

      const ledgerRows = contractPayments
        .map((p) => {
          runningBalance = Math.max(0, runningBalance - p.amount);
          installmentCounter += 1;
          const remark =
            p.remarks || CHANNEL_LABELS[p.paymentChannel] || p.paymentChannel;

          const due = installmentDueDate(c.startDate, installmentCounter);
          const payClass = agingCell(due, p.paymentDate);
          return `
        <tr>
          <td class="c">${esc(fmtDateShort(p.paymentDate))}</td>
          <td class="c">${esc(c.contractNumber)}</td>
          <td class="c">${esc(fmtDateShort(c.startDate))}</td>
          <td class="c">${due === null ? "—" : esc(fmtDateShort(due))}</td>
          <td class="c">${esc(php(p.amount))}</td>
          <td class="c">${esc(payClass)}</td>
          <td class="c">${installmentCounter}</td>
          <td class="c">${p.orNumber ? esc(p.orNumber) : ""}</td>
          <td class="c">${esc(php(runningBalance))}</td>
          <td class="c">${esc(remark)}</td>
        </tr>`;
        })
        .join("");

      const outstanding = Math.max(0, c.planAmount - c.totalPaid);
      /*
       * Payment status on the printed statement mirrors the portal: a
       * planholder paying ahead of schedule reads "Advanced", fully paid stays
       * "Good Payer" (solid, in the portal), and everything else uses the
       * stored contract status.
       */
      const status =
        c.contractStatus === "fully_paid"
          ? "Good Payer"
          : isAdvancedStatus(c.startDate, contractPayments.length, now)
            ? "Advanced"
            : (STATUS_LABELS[c.contractStatus] ?? c.contractStatus);

      return `
      <div class="plan-block">
        ${
          multiPlan
            ? `<p class="plan-heading">Plan ${index + 1} of ${data.contracts.length}</p>`
            : ""
        }

        <span class="sec-bar">Account Information</span>
        <table class="fields">
          <tr>
            ${fld("Branch:", data.branchName ?? "")}
            ${fld("Contract No.:", c.contractNumber, "narrow")}
          </tr>
          <tr>
            ${fld("Name:", data.clientName, "wide")}
            ${fld("Plan Type:", c.planType, "narrow")}
          </tr>
          <tr>
            ${fld("Address:", data.clientAddress, "wide")}
            ${fld("Plan Value:", php(c.planAmount), "narrow")}
          </tr>
          <tr>
            ${fld("Contact No.:", data.clientContact, "wide")}
            ${fld("Mode of Payment:", modeOfPayment, "narrow")}
          </tr>
          <tr>
            ${fld("Birth Date:", data.clientBirthDate ?? "", "wide")}
            ${fld("Term (Years):", termLabel, "narrow")}
          </tr>
          <tr>
            ${fld("Sales Agent:", data.salesAgent ?? "", "wide")}
            ${fld("Installment Amount:", php(c.monthlyAmortization), "narrow")}
          </tr>
        </table>

        <span class="sec-bar">Payment History</span>
        <table class="soa-grid">
          <thead>
            <tr>
              <th class="wp1">Payment Date</th>
              <th class="wp2">LPA Number</th>
              <th class="wp3">Effectivity Date</th>
              <th class="wp4">Due Date</th>
              <th class="wp5">Amount</th>
              <th class="wp6">Aging</th>
              <th class="wp7">Installment No.</th>
              <th class="wp8">O.R. No.</th>
              <th class="wp9">Balance</th>
              <th class="wp10">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${
              ledgerRows ||
              `<tr><td colspan="10" class="empty">No payments recorded</td></tr>`
            }
          </tbody>
        </table>

        <span class="sec-bar">Account Summary</span>
        <div class="summary">
          <div class="cell">
            <p class="lbl">Plan Value</p>
            <p class="val">${esc(php(c.planAmount))}</p>
          </div>
          <div class="cell">
            <p class="lbl">Total Paid</p>
            <p class="val">${esc(php(c.totalPaid))}</p>
          </div>
          <div class="cell">
            <p class="lbl">Outstanding Balance</p>
            <p class="val">${esc(php(outstanding))}</p>
          </div>
          <div class="cell">
            <p class="lbl">Payment Status</p>
            <p class="val">${esc(status)}</p>
          </div>
        </div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>${SOA_STYLES}</style>
</head>
<body>
  <div id="soa">

    <!-- ── Letterhead ── -->
    <div class="lh">
      ${data.logoUrl ? `<img class="lh-logo" src="${esc(data.logoUrl)}" alt="" />` : ""}
      <p class="lh-brand">Evangelist Funeral Services</p>
      <p class="lh-sub">${esc(COMPANY_ADDRESS)}</p>
    </div>

    <h1 class="doc-title">Statement of Account</h1>

    <!-- ── Plans ── -->
    ${
      plansHTML ||
      `<span class="sec-bar">Account Information</span>
       <table class="soa-grid">
         <tbody>
           <tr><td class="empty">No plan records on file for this planholder.</td></tr>
         </tbody>
       </table>`
    }

    <!-- ── Footer ── -->
    <div class="foot">
      <div class="foot-row">
        <div class="foot-rule"></div>
        <p class="foot-sign">Prepared by: Evangelist Funeral Services</p>
        <div class="foot-rule"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
