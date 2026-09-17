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

/** `₱ #,##0.00` */
function peso(amount: number) {
  return `\u20B1 ${fmtMoney(amount)}`;
}

/** `MM/DD/YYYY` — the date format on the statement. */
function fmtDateShort(ts: number) {
  return format(new Date(ts), "MM/dd/yyyy");
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

/**
 * One document stylesheet, shared by the PDF render and the on-screen preview
 * (`SOAButton` renders the same HTML into an iframe), so what a family sees in
 * the viewer is exactly what they download.
 *
 * The layout follows the printed statement template: circular seal + brand
 * block on the left, "A Life of Dignity / A Legacy of Love" on the right, a
 * centred serif title, then brand-green section bars over ruled fields and
 * bordered tables, and the four-cell account summary strip at the foot.
 */
const SOA_STYLES = `
  @page { size: A4; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Times New Roman', Times, Georgia, serif;
    color: #211f1a;
    background: #ffffff;
    font-size: 11.5px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  #soa {
    position: relative;
    width: 100%;
    max-width: 742px;
    margin: 0 auto;
    padding: 2px 0 6px;
    overflow: hidden;
  }

  /* ── Letterhead ─────────────────────────────────────────────────────── */
  .lh { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .lh-left { display: flex; align-items: center; gap: 12px; }
  .lh-logo { width: 64px; height: 64px; object-fit: contain; }
  .lh-brand {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-size: 29px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.01em;
    color: #1b4332;
  }
  .lh-sub {
    margin-top: 4px;
    font-size: 12px;
    letter-spacing: 0.30em;
    text-transform: uppercase;
    color: #1b4332;
  }
  .lh-motto {
    margin-top: 5px;
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5c6b60;
  }
  .lh-right { text-align: right; padding-top: 4px; }
  .lh-tag {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: 14px;
    line-height: 1.4;
    color: #1b4332;
  }
  .lh-tag-rule { margin: 7px 0 0 auto; width: 158px; height: 2px; background: #a9874f; }
  .lh-issued {
    margin-top: 7px;
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5c6b60;
  }

  /* ── Title ──────────────────────────────────────────────────────────── */
  .doc-title {
    margin: 16px 0 14px;
    text-align: center;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #1b4332;
  }

  /* ── Section bars ───────────────────────────────────────────────────── */
  .sec-bar {
    display: inline-block;
    margin: 12px 0 8px;
    padding: 4px 30px 4px 10px;
    background: #1b4332;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    /* The template's bar tapers to a point on the right. Browsers that can't
       clip degrade to a plain rectangle, which still reads correctly. */
    clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  }

  /* ── Ruled fields ───────────────────────────────────────────────────── */
  table.fields { width: 100%; border-collapse: collapse; }
  table.fields td { vertical-align: bottom; padding: 2px 0 5px; }
  .fld-label {
    width: 1%;
    white-space: nowrap;
    padding-right: 5px !important;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #33413a;
  }
  .fld-value {
    border-bottom: 1px solid #94a096;
    padding: 0 16px 2px 3px !important;
    font-size: 11.5px;
  }
  .fld-value.wide { padding-right: 26px !important; }
  .fld-value.narrow { padding-right: 6px !important; }

  /* ── Bordered tables (beneficiaries, payments) ──────────────────────── */
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.grid th, table.grid td { border: 1px solid #a9b4ab; padding: 5px 7px; font-size: 10.5px; }
  table.grid thead th {
    background: #eef1ea;
    color: #1b4332;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
  }
  table.grid td.c { text-align: center; }
  table.grid td.num { text-align: center; font-variant-numeric: tabular-nums; }
  table.grid td.r { text-align: right; font-variant-numeric: tabular-nums; }
  table.grid td.empty { text-align: center; font-style: italic; color: #6b7269; padding: 10px 7px; }
  table.grid tr.alt td { background: #fafbf9; }

  /* ── Account summary strip ──────────────────────────────────────────── */
  .summary { display: flex; border: 1px solid #a9b4ab; background: #f1f4ef; }
  .summary .cell { flex: 1 1 0; padding: 8px 10px; border-left: 1px solid #c6cfc6; }
  .summary .cell:first-child { border-left: none; }
  .summary .lbl {
    text-align: center;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #33413a;
  }
  .summary .val {
    margin-top: 5px;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: #1b4332;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ── Multi-plan statements ──────────────────────────────────────────── */
  .plan-block { page-break-inside: avoid; }
  .plan-block + .plan-block { margin-top: 8px; padding-top: 4px; border-top: 1px solid #d5dcd6; }
  .plan-heading {
    margin-top: 12px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #1b4332;
  }

  /* ── Footer ─────────────────────────────────────────────────────────── */
  .foot { margin-top: 18px; page-break-inside: avoid; }
  .foot-row { display: flex; align-items: center; gap: 14px; }
  .foot-rule { flex: 1 1 auto; height: 1px; background: #a9b4ab; }
  .foot-sign {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: 12.5px;
    color: #211f1a;
    white-space: nowrap;
  }
  .foot-motto {
    margin-top: 7px;
    text-align: center;
    font-size: 8.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #5c6b60;
  }

  /* ── Seal watermark ─────────────────────────────────────────────────── */
  .mark { position: absolute; right: -14px; bottom: -16px; width: 130px; height: 130px; opacity: 0.06; }
`;

export function generateSOAHTML(data: SOAData): string {
  /** A label sitting on the same ruled line as its value. */
  const fld = (label: string, value: string, valueClass = "") =>
    `<td class="fld-label">${esc(label)}</td><td class="fld-value ${valueClass}">${esc(value)}</td>`;

  // ── Beneficiaries: the template always shows four numbered rows ────────
  const beneficiaryRows = Array.from({ length: 4 }, (_, i) => {
    const b = data.beneficiaries[i];
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${b ? esc(b.name) : ""}</td>
        <td class="c">${b?.age !== undefined ? esc(b.age) : ""}</td>
        <td class="c">${b ? esc(b.relationship) : ""}</td>
      </tr>`;
  }).join("");

  // ── Plan blocks ────────────────────────────────────────────────────────
  const multiPlan = data.contracts.length > 1;

  const plansHTML = data.contracts
    .map((c, index) => {
      const contractPayments = data.payments
        .filter((p) => p.contractNumber === c.contractNumber)
        .sort((a, b) => a.paymentDate - b.paymentDate);

      let runningBalance = c.planAmount;
      let installmentCounter = 0;

      const ledgerRows = contractPayments
        .map((p, i) => {
          runningBalance = Math.max(0, runningBalance - p.amount);
          installmentCounter += 1;
          const remark =
            p.remarks || CHANNEL_LABELS[p.paymentChannel] || p.paymentChannel;
          return `
        <tr class="${i % 2 === 1 ? "alt" : ""}">
          <td class="c">${fmtDateShort(p.paymentDate)}</td>
          <td class="c">${p.orNumber ? esc(p.orNumber) : ""}</td>
          <td class="r">${esc(peso(p.amount))}</td>
          <td class="num">${installmentCounter}</td>
          <td class="r">${esc(peso(runningBalance))}</td>
          <td>${esc(remark)}</td>
        </tr>`;
        })
        .join("");

      const outstanding = Math.max(0, c.planAmount - c.totalPaid);
      const status = STATUS_LABELS[c.contractStatus] ?? c.contractStatus;

      return `
      <div class="plan-block">
        ${
          multiPlan
            ? `<p class="plan-heading">Plan ${index + 1} of ${data.contracts.length}</p>`
            : ""
        }

        <span class="sec-bar">Plan Information</span>
        <table class="fields">
          <tr>
            ${fld("Plan Value:", peso(c.planAmount))}
            ${fld("Sales Agent:", data.salesAgent || "\u2014")}
          </tr>
          <tr>
            ${fld("Plan Type:", c.planType)}
            ${fld("EFS OPC Control No.:", c.contractNumber)}
          </tr>
        </table>

        <span class="sec-bar">Payment History</span>
        <table class="grid">
          <colgroup>
            <col style="width:15%" />
            <col style="width:15%" />
            <col style="width:16%" />
            <col style="width:15%" />
            <col style="width:17%" />
            <col style="width:22%" />
          </colgroup>
          <thead>
            <tr>
              <th>Date<br />(MM/DD/YYYY)</th>
              <th>O.R. No.</th>
              <th>Amount</th>
              <th>Installment<br />Number</th>
              <th>Balance</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${
              ledgerRows ||
              `<tr><td colspan="6" class="empty">No payments recorded</td></tr>`
            }
          </tbody>
        </table>

        <span class="sec-bar">Account Summary</span>
        <div class="summary">
          <div class="cell">
            <p class="lbl">Plan Value</p>
            <p class="val">${esc(peso(c.planAmount))}</p>
          </div>
          <div class="cell">
            <p class="lbl">Total Paid</p>
            <p class="val">${esc(peso(c.totalPaid))}</p>
          </div>
          <div class="cell">
            <p class="lbl">Outstanding Balance</p>
            <p class="val">${esc(peso(outstanding))}</p>
          </div>
          <div class="cell">
            <p class="lbl">Payment Status</p>
            <p class="val">${esc(status)}</p>
          </div>
        </div>
      </div>`;
    })
    .join("");

  const issuedLine = [
    `Issued ${data.generatedDate}`,
    data.branchName ? data.branchName : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <!-- Letterhead face. Georgia is the app's own display font, so it is the
       fallback if the webfont can't be fetched (offline / blocked network). -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&display=swap"
    rel="stylesheet"
  />
  <style>${SOA_STYLES}</style>
</head>
<body>
  <div id="soa">

    <!-- ── Letterhead ── -->
    <div class="lh">
      <div class="lh-left">
        ${data.logoUrl ? `<img class="lh-logo" src="${esc(data.logoUrl)}" alt="" />` : ""}
        <div>
          <p class="lh-brand">Evangelist</p>
          <p class="lh-sub">Funeral Services</p>
          <p class="lh-motto">In life and beyond, we care.</p>
        </div>
      </div>
      <div class="lh-right">
        <p class="lh-tag">A Life of Dignity<br />A Legacy of Love</p>
        <div class="lh-tag-rule"></div>
        <p class="lh-issued">${esc(issuedLine)}</p>
      </div>
    </div>

    <h1 class="doc-title">Statement of Account</h1>

    <!-- ── Planholder information ── -->
    <span class="sec-bar">Planholder Information</span>
    <table class="fields">
      <tr>
        ${fld("Planholder's Name:", data.clientName, "wide")}
        ${fld("CP No.:", data.clientContact, "narrow")}
      </tr>
      <tr>
        ${fld("Address:", data.clientAddress, "wide")}
        ${fld("Age:", data.clientAge !== undefined ? String(data.clientAge) : "\u2014", "narrow")}
      </tr>
      <tr>
        <td class="fld-label">&nbsp;</td>
        <td class="fld-value wide">${esc(data.clientEmail || "")}</td>
        ${fld("Birthday:", data.clientBirthDate || "\u2014", "narrow")}
      </tr>
    </table>

    <!-- ── Beneficiaries ── -->
    <span class="sec-bar">Beneficiaries</span>
    <table class="grid">
      <colgroup>
        <col style="width:6%" />
        <col style="width:54%" />
        <col style="width:15%" />
        <col style="width:25%" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Age</th>
          <th>Relationship</th>
        </tr>
      </thead>
      <tbody>${beneficiaryRows}</tbody>
    </table>

    <!-- ── Plans ── -->
    ${
      plansHTML ||
      `<span class="sec-bar">Plan Information</span>
       <table class="grid">
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
      <p class="foot-motto">Service Today. Peace Forever.</p>
    </div>

    ${
      data.logoUrl
        ? `<img class="mark" src="${esc(data.logoUrl)}" alt="" />`
        : ""
    }
  </div>
</body>
</html>`;
}
