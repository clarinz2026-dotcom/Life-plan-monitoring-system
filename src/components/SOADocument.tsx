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

/** Main office as printed on the original statement template. */
const OFFICE_ADDRESS =
  "2nd Floor, Gabrinez Bldg., Fortich St., Malaybalay City, Bukidnon 8700";

const STATUS_LABELS: Record<string, string> = {
  current: "Current",
  delinquent_30: "30 Days Late",
  delinquent_60: "60 Days Late",
  delinquent_90: "90 Days Late",
  lapsed: "Lapsed",
  fully_paid: "Fully Paid",
};

function fmtMoney(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

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

export function generateSOAHTML(data: SOAData): string {
  // ── Planholder fields ──────────────────────────────────────────────────
  const field = (label: string, value: string) =>
    `<td class="fl">${esc(label)}</td><td class="fv">${esc(value)}</td>`;

  // ── Beneficiaries (up to 4) ────────────────────────────────────────────
  const beneficiaryRows = data.beneficiaries.slice(0, 4);
  const beneficiaryHTML =
    beneficiaryRows.length > 0
      ? beneficiaryRows
          .map(
            (b, i) => `
      <tr>
        <td class="bnum">${i + 1}.</td>
        <td class="bname">${esc(b.name)}</td>
        <td class="blabel">Age:</td>
        <td class="bage">${b.age !== undefined ? esc(b.age) : "&nbsp;"}</td>
        <td class="blabel">Relationship:</td>
        <td class="brel">${esc(b.relationship)}</td>
      </tr>`
          )
          .join("")
      : `<tr><td colspan="6" class="empty">No beneficiaries recorded</td></tr>`;

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
          return `
        <tr class="${i % 2 === 1 ? "alt" : ""}">
          <td class="c">${fmtDateShort(p.paymentDate)}</td>
          <td class="c">${p.orNumber ? esc(p.orNumber) : "&mdash;"}</td>
          <td class="r">${fmtMoney(p.amount)}</td>
          <td class="c">${installmentCounter}</td>
          <td class="r">${fmtMoney(runningBalance)}</td>
          <td>${esc(p.remarks ?? "Paid")}</td>
        </tr>`;
        })
        .join("");

      const outstanding = Math.max(0, c.planAmount - c.totalPaid);
      const status = STATUS_LABELS[c.contractStatus] ?? c.contractStatus;

      return `
      <div class="plan-block">
        ${
          multiPlan
            ? `<p class="plan-heading">Plan ${index + 1} of ${data.contracts.length} &mdash; ${esc(c.planType)} <span class="plan-heading-sub">(Control No. ${esc(c.contractNumber)})</span></p>`
            : ""
        }

        <table class="fields field-grid">
          <tr>
            ${field("PLAN VALUE:", `\u20B1 ${fmtMoney(c.planAmount)}`)}
            ${field("PLAN TYPE:", c.planType)}
          </tr>
          <tr>
            ${field("SALES AGENT:", data.salesAgent || "\u2014")}
            ${field("CONTROL NO.:", c.contractNumber)}
          </tr>
        </table>

        <p class="section">Payment History</p>
        <table class="ledger">
          <thead>
            <tr>
              <th class="c">Date</th>
              <th class="c">O.R. No.</th>
              <th class="r">Amount</th>
              <th class="c">Inst.</th>
              <th class="r">Balance</th>
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

        <table class="totals">
          <tr>
            <td class="tl">Plan Value:</td>
            <td class="tv">&#8369; ${fmtMoney(c.planAmount)}</td>
            <td class="tl">Total Paid:</td>
            <td class="tv">&#8369; ${fmtMoney(c.totalPaid)}</td>
          </tr>
          <tr>
            <td class="tl">Outstanding Balance:</td>
            <td class="tv tv-strong${outstanding > 0 ? " tv-due" : " tv-paid"}">&#8369; ${fmtMoney(outstanding)}</td>
            <td class="tl">Status:</td>
            <td class="tv tv-strong">${esc(status)}</td>
          </tr>
        </table>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <!-- Letterhead face. Georgia is the app's own display font, so it is the
       fallback if the webfont can't be fetched (offline / blocked network). -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap"
    rel="stylesheet"
  />
  <style>
    @page { size: A4; margin: 14mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      color: #14181f;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #soa { max-width: 740px; margin: 0 auto; }

    /* ── Letterhead ── */
    .letterhead { display: flex; align-items: center; justify-content: center; gap: 16px; }
    .brand-logo { width: 72px; height: 72px; border-radius: 50%; object-fit: contain; }
    .brand-name {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 30px;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: #1f4d3a;
      line-height: 1.15;
    }
    .brand-tagline {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 12.5px;
      font-style: italic;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: #6b7280;
      margin-top: 4px;
    }
    .brand-address { text-align: center; font-size: 11.5px; color: #4b5563; margin-top: 8px; }
    .rule { border-top: 2px solid #1f4d3a; margin: 12px 0 0; }

    /* ── Title ── */
    .doc-title {
      text-align: center; font-size: 19px; font-weight: bold;
      letter-spacing: 0.16em; text-transform: uppercase; color: #1f4d3a;
      margin: 22px 0 4px;
    }
    .doc-meta {
      display: flex; justify-content: center; gap: 28px;
      font-size: 10.5px; color: #6b7280; letter-spacing: 0.04em;
      padding-bottom: 14px; border-bottom: 1px solid #d8ddd8; margin-bottom: 4px;
    }
    .doc-meta strong { color: #14181f; font-weight: bold; }

    /* ── Section labels ── */
    .section {
      font-size: 10.5px; font-weight: bold; text-transform: uppercase;
      letter-spacing: 0.16em; color: #1f4d3a;
      margin: 22px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #d8ddd8;
    }

    /* ── Fill-in style fields ── */
    table.fields { width: 100%; border-collapse: collapse; }
    table.fields td { padding: 5px 0 3px; vertical-align: bottom; }
    td.fl {
      width: 1%; white-space: nowrap; padding-right: 6px;
      font-size: 10.5px; font-weight: bold; letter-spacing: 0.06em; color: #4b5563;
    }
    td.fv {
      border-bottom: 1px solid #b9c2bb; padding-left: 4px; padding-right: 24px;
      font-size: 12.5px; color: #14181f; min-width: 120px;
    }
    .field-grid td.fv { padding-right: 16px; }
    .field-grid td.fl { padding-top: 7px; }

    /* ── Beneficiaries ── */
    table.benef { width: 100%; border-collapse: collapse; }
    table.benef td { padding: 6px 0 3px; vertical-align: bottom; }
    td.bnum { width: 20px; font-weight: bold; color: #4b5563; font-size: 11px; }
    td.bname { border-bottom: 1px solid #b9c2bb; padding-right: 18px; font-size: 12.5px; }
    td.blabel { width: 1%; white-space: nowrap; padding: 6px 6px 3px 16px; font-size: 10.5px; font-weight: bold; letter-spacing: 0.06em; color: #4b5563; }
    td.bage { width: 56px; border-bottom: 1px solid #b9c2bb; text-align: center; font-size: 12.5px; }
    td.brel { width: 170px; border-bottom: 1px solid #b9c2bb; padding-left: 4px; font-size: 12.5px; }

    /* ── Ledger ── */
    table.ledger { width: 100%; border-collapse: collapse; margin-top: 2px; }
    table.ledger th {
      background: #f2f5f2; border-top: 1.5px solid #1f4d3a; border-bottom: 1.5px solid #1f4d3a;
      padding: 8px 8px; font-size: 9.5px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.1em; color: #1f4d3a;
    }
    table.ledger td {
      padding: 8px; font-size: 11.5px; border-bottom: 1px solid #e3e7e3;
      font-variant-numeric: tabular-nums;
    }
    table.ledger tr.alt td { background: #fafbfa; }
    .c { text-align: center; }
    .r { text-align: right; }
    .empty { text-align: center !important; font-style: italic; color: #6b7280; padding: 16px 8px !important; }

    /* ── Totals ── */
    table.totals {
      width: 100%; border-collapse: collapse; margin-top: 16px;
      background: #f7f9f7; border: 1px solid #d8ddd8;
    }
    table.totals td { padding: 10px 14px; font-size: 11.5px; font-variant-numeric: tabular-nums; }
    td.tl {
      width: 1%; white-space: nowrap; font-size: 10.5px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.08em; color: #4b5563;
    }
    td.tv { font-size: 13px; font-weight: bold; color: #14181f; padding-right: 34px; }
    td.tv-strong { color: #1f4d3a; }
    td.tv-due { color: #a34700; }
    td.tv-paid { color: #14683c; }

    /* ── Plan blocks ── */
    .plan-block { page-break-inside: avoid; margin-bottom: 30px; }
    .plan-block + .plan-block { margin-top: 34px; padding-top: 6px; border-top: 1px dashed #d8ddd8; }
    .plan-heading {
      font-size: 11px; font-weight: bold; color: #14181f;
      letter-spacing: 0.04em; margin-bottom: 4px;
    }
    .plan-heading-sub { font-weight: normal; color: #6b7280; font-size: 10.5px; }

    /* ── Footer / signature ── */
    .signoff {
      margin-top: 42px; padding-top: 16px; border-top: 1px solid #d8ddd8;
      page-break-inside: avoid;
    }
    .signoff-grid { display: flex; justify-content: space-between; gap: 40px; margin-top: 26px; }
    .sig-block { width: 46%; }
    .sig-line { border-bottom: 1px solid #14181f; height: 26px; }
    .sig-caption { margin-top: 6px; font-size: 10.5px; color: #4b5563; letter-spacing: 0.04em; }
    .sig-caption strong { display: block; font-size: 11.5px; color: #14181f; }
    .disclaimer {
      margin-top: 24px; font-size: 9.5px; line-height: 1.6; color: #6b7280;
      text-align: center; font-style: italic;
    }
  </style>
</head>
<body>
  <div id="soa">

    <!-- ── Letterhead ── -->
    <div class="letterhead">
      ${data.logoUrl ? `<img class="brand-logo" src="${esc(data.logoUrl)}" alt="" />` : ""}
      <div>
        <p class="brand-name">Evangelist Funeral Services OPC</p>
        <p class="brand-tagline">&ldquo;To Care and To Serve&rdquo;</p>
      </div>
    </div>
    <p class="brand-address">${OFFICE_ADDRESS}</p>
    <div class="rule"></div>

    <h1 class="doc-title">Statement of Account</h1>
    <div class="doc-meta">
      <span>Account No.: <strong>${esc(data.accountNumber)}</strong></span>
      <span>Date Issued: <strong>${esc(data.generatedDate)}</strong></span>
      ${data.branchName ? `<span>Branch: <strong>${esc(data.branchName)}</strong></span>` : ""}
    </div>

    <!-- ── Planholder information ── -->
    <p class="section">Planholder Information</p>
    <table class="fields">
      <tr>
        ${field("PLANHOLDER:", data.clientName)}
        ${field("CP NO.:", data.clientContact)}
      </tr>
      <tr>
        ${field("ADDRESS:", data.clientAddress)}
        ${field("AGE:", data.clientAge !== undefined ? String(data.clientAge) : "\u2014")}
      </tr>
      <tr>
        <td class="fl"></td>
        <td class="fv" style="border-bottom:none;"></td>
        ${field("BIRTHDAY:", data.clientBirthDate || "\u2014")}
      </tr>
    </table>

    <!-- ── Beneficiaries ── -->
    <p class="section">Beneficiaries</p>
    <table class="benef">
      ${beneficiaryHTML}
    </table>

    <!-- ── Plans ── -->
    ${
      plansHTML ||
      `<p class="section">Plan Information</p>
       <p class="empty" style="text-align:left !important;padding-left:0 !important;">No plan records on file for this planholder.</p>`
    }

    <!-- ── Sign-off ── -->
    <div class="signoff">
      <div class="signoff-grid">
        <div class="sig-block">
          <div class="sig-line"></div>
          <p class="sig-caption">
            <strong>Prepared by</strong>
            Evangelist Funeral Services
          </p>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <p class="sig-caption">
            <strong>Received by</strong>
            Planholder / Authorized Representative
          </p>
        </div>
      </div>
      <p class="disclaimer">
        This Statement of Account reflects all payments recorded in our system as of
        the date issued above. Please report any discrepancy to your branch office.
      </p>
    </div>

  </div>
</body>
</html>`;
}
