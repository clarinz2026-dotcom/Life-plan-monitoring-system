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
  "2nd Floor, Gabrinez Bldg., Fortich St., Malaybalay City, Bukidnon, 8700";

const PAY_CLASS: Record<string, string> = {
  cash: "CASH",
  gcash: "GCASH",
  maya: "MAYA",
  bank_transfer: "BANK TRANSFER",
  check: "CHECK",
};

function fmtPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtNum(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDateShort(ts: number) {
  return format(new Date(ts), "MM/dd/yyyy");
}

export function generateSOAHTML(data: SOAData): string {
  // ── Beneficiary rows (up to 4) ───────────────────────────────────────
  const beneficiaryRows = data.beneficiaries.length > 0
    ? data.beneficiaries.slice(0, 4).map((b, i) =>
        `<tr>
          <td class="lbl">${i + 1}. Name:</td><td class="val">${b.name}</td>
          <td class="lbl">Age:</td><td class="val">${b.age ?? "—"}</td>
          <td class="lbl">Relationship:</td><td class="val">${b.relationship}</td>
        </tr>`
      ).join("")
    : `<tr><td class="lbl">1. Name:</td><td class="val" colspan="5">—</td></tr>`;

  // ── Per-contract sections ─────────────────────────────────────────────
  const contractsHTML = data.contracts
    .map((c) => {
      const termYears =
        c.monthlyAmortization > 0
          ? Math.round(c.planAmount / c.monthlyAmortization / 12)
          : null;

      // Ledger rows — oldest first, with running balance like the template.
      const contractPayments = data.payments
        .filter((p) => p.contractNumber === c.contractNumber)
        .sort((a, b) => a.paymentDate - b.paymentDate);

      let runningBalance = c.planAmount;
      let installmentCounter = 0;

      const ledgerRows = contractPayments
        .map((p) => {
          runningBalance = Math.max(0, runningBalance - p.amount);
          installmentCounter += 1;
          return `
        <tr>
          <td class="center">${PAY_CLASS[p.paymentChannel] ?? p.paymentChannel.toUpperCase()}</td>
          <td class="center">${fmtDateShort(p.paymentDate)}</td>
          <td class="center">${p.orNumber || "—"}</td>
          <td class="num">${fmtNum(p.amount)}</td>
          <td class="center">${installmentCounter}</td>
          <td class="num">${fmtNum(runningBalance)}</td>
          <td>${p.remarks ?? "Paid"}</td>
        </tr>`;
        })
        .join("");

      return `
      <div class="contract-block">

        <table class="plan-info">
          <tr>
            <td class="lbl">Plan Value:</td><td class="val">${fmtPeso(c.planAmount)}</td>
            <td class="lbl">Plan Type:</td><td class="val">${c.planType}</td>
          </tr>
          <tr>
            <td class="lbl">Sales Agent:</td><td class="val">${data.salesAgent || "—"}</td>
            <td class="lbl">EFS OPC Control No.:</td><td class="val">${c.contractNumber}</td>
          </tr>
        </table>

        <div class="ledger-label">PAYMENT HISTORY</div>
        <table class="ledger">
          <thead>
            <tr>
              <th>Date</th>
              <th>O.R. No.</th>
              <th class="num">Amount</th>
              <th>Installment No.</th>
              <th class="num">Balance</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${
              ledgerRows ||
              `<tr><td colspan="6" style="text-align:center;font-style:italic;color:#666;padding:12px;">No payments recorded</td></tr>`
            }
          </tbody>
        </table>

        <table class="summary-table">
          <tr>
            <td class="lbl">Plan Value:</td><td class="val bold">${fmtPeso(c.planAmount)}</td>
            <td class="lbl">Total Paid:</td><td class="val bold green">${fmtPeso(c.totalPaid)}</td>
            <td class="lbl">Outstanding Balance:</td><td class="val bold ${c.planAmount - c.totalPaid > 0 ? "amber" : "green"}">${fmtPeso(Math.max(0, c.planAmount - c.totalPaid))}</td>
          </tr>
        </table>
      </div>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, 'Segoe UI', Roboto, sans-serif;
      color: #000;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.45;
    }
    #soa-content {
      max-width: 740px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .brand-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .brand-logo {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      object-fit: contain;
    }
    .brand-name {
      font-family: 'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive;
      font-size: 34px;
      font-weight: bold;
      color: #1f4fa3;
      line-height: 1.15;
    }
    .brand-tagline {
      font-style: italic;
      color: #000;
      font-size: 12px;
      margin-top: 2px;
    }
    .brand-address {
      text-align: center;
      font-size: 11.5px;
      font-weight: bold;
      margin-top: 8px;
    }
    .divider {
      border-top: 2px solid #b45309;
      margin: 8px 0 14px;
    }
    h1 {
      text-align: center;
      font-size: 17px;
      letter-spacing: 2px;
      margin: 0 0 16px;
      color: #b91c1c;
      text-transform: uppercase;
    }

    /* ── Planholder Info ── */
    table.planholder {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    table.planholder td {
      padding: 3px 4px;
      vertical-align: top;
      font-size: 11px;
    }
    td.lbl {
      width: 17%;
      font-weight: bold;
      white-space: nowrap;
    }
    td.val {
      width: 33%;
    }

    /* ── Beneficiaries ── */
    .section-label {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #333;
      margin: 10px 0 6px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 3px;
    }

    /* ── Plan Info ── */
    table.plan-info {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.plan-info td {
      padding: 3px 4px;
      vertical-align: top;
      font-size: 11px;
    }

    /* ── Ledger ── */
    .ledger-label {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #333;
      margin: 10px 0 6px;
    }
    table.ledger {
      width: 100%;
      border-collapse: collapse;
    }
    table.ledger th {
      border: 1px solid #000;
      background: #f2f2f2;
      padding: 5px 6px;
      font-size: 10px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table.ledger td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 10.5px;
    }
    td.num, th.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    td.center {
      text-align: center;
    }

    /* ── Summary ── */
    .contract-block {
      margin-bottom: 26px;
      page-break-inside: avoid;
    }
    table.summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    table.summary-table td {
      padding: 5px 8px;
      font-size: 11px;
    }
    .bold { font-weight: bold; }
    .green { color: #166534; }
    .amber { color: #b45309; }

    /* ── Signatures ── */
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 44px;
      padding-top: 8px;
    }
    .signatures > div {
      text-align: center;
      width: 45%;
    }
    .sig-label {
      font-size: 11px;
    }
    .sig-name {
      font-weight: bold;
      margin-top: 36px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .sig-title {
      font-size: 10px;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div id="soa-content">
    <!-- ── Company Header ── -->
    <div class="brand-header">
      ${data.logoUrl ? `<img class="brand-logo" src="${data.logoUrl}" alt="Evangelist Funeral Services OPC" />` : ""}
      <div>
        <p class="brand-name">Evangelist Funeral Services OPC</p>
        <p class="brand-tagline">&ldquo;To Care and To Serve&rdquo;</p>
      </div>
    </div>
    <p class="brand-address">${OFFICE_ADDRESS}</p>
    <div class="divider"></div>
    <h1>Statement of Account</h1>

    <!-- ── Planholder Information ── -->
    <div class="section-label">Planholder Information</div>
    <table class="planholder">
      <tr>
        <td class="lbl">Name:</td>
        <td class="val" style="text-transform:uppercase;font-weight:bold;">${data.clientName}</td>
        <td class="lbl">Age:</td>
        <td class="val">${data.clientAge ?? "—"}</td>
      </tr>
      <tr>
        <td class="lbl">Address:</td>
        <td class="val" colspan="3">${data.clientAddress}</td>
      </tr>
      <tr>
        <td class="lbl">Birthday:</td>
        <td class="val">${data.clientBirthDate || "—"}</td>
        <td class="lbl">CP No.:</td>
        <td class="val">${data.clientContact}</td>
      </tr>
    </table>

    <!-- ── Beneficiaries ── -->
    <div class="section-label">Beneficiaries</div>
    <table class="planholder">
      ${beneficiaryRows}
    </table>

    <!-- ── Plan Info + Payment History + Summary per contract ── -->
    <div class="section-label">Plan Information</div>
    ${contractsHTML}

    <!-- ── Signatures ── -->
    <div class="signatures">
      <div>
        <p class="sig-label">Prepared by:</p>
        <p class="sig-name">Analyn M. Pacana</p>
        <p class="sig-title">Finance Head, EFS OPC</p>
      </div>
      <div>
        <p class="sig-label">Approved by:</p>
        <p class="sig-name">Evangeline M. Pacana</p>
        <p class="sig-title">Chief Executive Officer, EFS OPC</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
