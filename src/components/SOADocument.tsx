import { format } from "date-fns";

export interface SOAData {
  clientName: string;
  clientAddress: string;
  clientContact: string;
  clientEmail?: string;
  beneficiaryName: string;
  beneficiaryRelationship: string;
  /** Branch shown under "Branch:" on the statement. */
  branchName?: string;
  /** Sales agent shown under "Sales Agent:". */
  salesAgent?: string;
  /** Pre-formatted birth date (e.g. "January 19, 1961"). */
  clientBirthDate?: string;
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

/** "Amer, Mariam Mosa" → "MARIAM MOSA AMER" (as printed on the template). */
function displayName(name: string): string {
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[1]} ${parts[0]}`.toUpperCase();
  }
  return name.toUpperCase();
}

export function generateSOAHTML(data: SOAData): string {
  const contractsHTML = data.contracts
    .map((c) => {
      const termYears =
        c.monthlyAmortization > 0
          ? Math.round(c.planAmount / c.monthlyAmortization / 12)
          : null;
      const installmentMonth =
        c.monthlyAmortization > 0
          ? Math.round(c.totalPaid / c.monthlyAmortization)
          : null;

      // Ledger rows — oldest first, with a running balance like the template.
      const contractPayments = data.payments
        .filter((p) => p.contractNumber === c.contractNumber)
        .sort((a, b) => a.paymentDate - b.paymentDate);

      let runningBalance = c.planAmount;
      const ledgerRows = contractPayments
        .map((p) => {
          runningBalance = Math.max(0, runningBalance - p.amount);
          const installmentNo =
            c.monthlyAmortization > 0
              ? Math.round(p.amount / c.monthlyAmortization)
              : "—";
          return `
        <tr>
          <td>${PAY_CLASS[p.paymentChannel] ?? p.paymentChannel.toUpperCase()}</td>
          <td>${format(new Date(p.paymentDate), "dd-MMM-yyyy")}</td>
          <td>${p.orNumber || "—"}</td>
          <td class="num">${fmtNum(p.amount)}</td>
          <td class="num">${installmentNo}</td>
          <td class="num">${fmtNum(runningBalance)}</td>
          <td>${p.remarks ?? ""}</td>
        </tr>`;
        })
        .join("");

      return `
      <div class="contract-block">
        <table class="info">
          <tr>
            <td class="lbl">Branch:</td><td class="val">${data.branchName || "—"}</td>
            <td class="lbl">Plan Type:</td><td class="val">${c.planType}</td>
          </tr>
          <tr>
            <td class="lbl">Contract No.:</td><td class="val">${c.contractNumber}</td>
            <td class="lbl">Plan Value:</td><td class="val">${fmtPeso(c.planAmount)}</td>
          </tr>
          <tr>
            <td class="lbl">Name:</td><td class="val">${displayName(data.clientName)}</td>
            <td class="lbl">Mode of Payment:</td><td class="val">Monthly</td>
          </tr>
          <tr>
            <td class="lbl">Birth Date:</td><td class="val">${data.clientBirthDate || "—"}</td>
            <td class="lbl">Term (Years):</td><td class="val">${termYears ?? "—"}</td>
          </tr>
          <tr>
            <td class="lbl">Address:</td><td class="val">${data.clientAddress}</td>
            <td class="lbl">Installment Amount:</td><td class="val">${fmtNum(c.monthlyAmortization)}</td>
          </tr>
          <tr>
            <td class="lbl">Contact No.:</td><td class="val">${data.clientContact}</td>
            <td class="lbl">Installment Month:</td><td class="val">${installmentMonth ?? "—"}</td>
          </tr>
          <tr>
            <td class="lbl">Sales Agent:</td><td class="val">${data.salesAgent || "—"}</td>
            <td class="lbl"></td><td class="val"></td>
          </tr>
        </table>

        <table class="ledger">
          <thead>
            <tr>
              <th>Pay Class</th>
              <th>O.R. Date</th>
              <th>O.R. No.</th>
              <th class="num">Amount</th>
              <th class="num">Installment No.</th>
              <th class="num">Balance</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${
              ledgerRows ||
              `<tr><td colspan="7" style="text-align: center; font-style: italic; color: #666; padding: 12px;">No payments recorded</td></tr>`
            }
          </tbody>
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
    .office {
      text-align: center;
      font-size: 12px;
      font-weight: bold;
    }
    h1 {
      text-align: center;
      font-size: 18px;
      letter-spacing: 2px;
      margin: 14px 0 4px;
      text-transform: uppercase;
    }
    .divider {
      border-top: 2px solid #000;
      margin: 8px 0 16px;
    }
    .contract-block {
      margin-bottom: 26px;
      page-break-inside: avoid;
    }
    table.info {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.info td {
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
    <p class="office">${OFFICE_ADDRESS}</p>
    <h1>Statement of Account</h1>
    <div class="divider"></div>

    ${contractsHTML}

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