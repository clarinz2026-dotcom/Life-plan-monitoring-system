import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Shared parser for the bulk payment upload (CSV / XLSX).
 *
 * Two layouts are accepted, auto-detected per file:
 *
 * 1. Flat ledger — one header row, one payment per row:
 *      contractNumber, amount, channel, date, orNumber, remarks
 *
 * 2. Sprinter-style statement — the old system's export. A header block of
 *    `Label: value` lines identifies the plan (Contract No., Name, Branch,
 *    Plan Type, ...), followed by a payment grid:
 *      Pay Class | O.R. Date | O.R. No. | Amount | Installment No. | Balance | Remarks
 *    Files may repeat blocks for several contracts in one workbook.
 */

export interface ParsedPaymentRow {
  contractNumber: string;
  amount: number;
  channel: string;
  /** Raw date string as parsed; the caller converts to a timestamp. */
  date: string;
  orNumber: string;
  remarks: string;
  /** True when the row came from a statement-style grid. */
  fromStatement: boolean;
}

export interface ParseResult {
  rows: ParsedPaymentRow[];
  warnings: string[];
}

const VALID_CHANNELS = new Set(["cash", "gcash", "maya", "bank_transfer", "check"]);

/** Normalize a spreadsheet cell to a trimmed string (numbers included). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Parse a date cell into an ISO date string for `<input type="date">` display.
 * Accepts ISO, MM/DD/YYYY, DD-MM-YYYY, "17-Dec-2025", and XLSX serial numbers.
 */
export function parseUploadDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // XLSX serial date (days since 1899-12-30), e.g. 45663
  if (/^\d{5}(\.\d+)?$/.test(value)) {
    const serial = parseFloat(value);
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  // 17-Dec-2025 / 17 December 2025
  const dmyMon = value.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s]?(\d{2,4})$/);
  if (dmyMon) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const m = months.indexOf(dmyMon[2].slice(0, 3).toLowerCase());
    if (m >= 0) {
      let year = parseInt(dmyMon[3], 10);
      if (year < 100) year += 2000;
      return `${year}-${String(m + 1).padStart(2, "0")}-${dmyMon[1].padStart(2, "0")}`;
    }
  }

  // MM/DD/YYYY or MM-DD-YYYY (US order, the format the app displays)
  const mdy = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.split("T")[0];

  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? null : fallback.toISOString().split("T")[0];
}

/** Map a channel cell to one of the app's five payment channels. */
export function normalizeChannel(raw: string): string {
  const value = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z_]/g, "");
  if (!value) return "cash";
  if (VALID_CHANNELS.has(value)) return value;
  if (value.includes("gcash")) return "gcash";
  if (value.includes("maya")) return "maya";
  if (value.includes("bank") || value.includes("transfer")) return "bank_transfer";
  if (value.includes("check") || value.includes("cheque")) return "check";
  return "cash";
}

/** Parse a currency cell — strips ₱, commas, and spaces; "650.00" → 650. */
export function parseMoney(raw: string): number {
  const value = raw.replace(/[₱,\s]/g, "");
  if (!value || value === ".") return NaN;
  return parseFloat(value);
}

/** Find a header cell matching /contract/ in a grid row. */
function contractColumnIndex(headers: string[]): number {
  const idx = headers.findIndex((h) => h.toLowerCase().includes("contract"));
  return idx;
}

/** Read the `Label: value` statement header block above the payment grid. */
function extractStatementBlock(grid: unknown[][]): { contractNumber: string; name: string; headerRowIdx: number } {
  let contractNumber = "";
  let name = "";
  let headerRowIdx = -1;

  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      const raw = cell(row[c]);
      const label = raw.toLowerCase().replace(/[:\s]+$/, "");
      if (!label) continue;

      // Value either follows the colon inside this cell ("Contract No.: 014101")
      // or sits in the adjacent cell ("Contract No.:" | "014101").
      const valueOf = () => {
        const colon = raw.indexOf(":");
        if (colon >= 0) {
          const inline = raw.slice(colon + 1).trim();
          if (inline) return inline;
        }
        return cell(row[c + 1]);
      };

      // Contract identifier: "Contract No.: 014101"
      if (!contractNumber && (label.includes("contract no") || label === "contract")) {
        contractNumber = valueOf();
      }
      // Planholder: "Name: FE R. RANALAN"
      if (!name && (label === "name" || label.startsWith("name:"))) {
        name = valueOf();
      }
    }

    // Payment grid header row: contains both "O.R." (date column) and "Amount"
    const joined = row.map((v) => cell(v).toLowerCase()).join("|");
    if (headerRowIdx === -1 && joined.includes("o.r.") && joined.includes("amount")) {
      headerRowIdx = r;
      break; // Header found — the block above is complete.
    }
  }

  return { contractNumber, name, headerRowIdx };
}

/** Locate the O.R. Date / O.R. No. / Amount / Remarks column offsets in a grid header. */
function mapStatementColumns(headerRow: unknown[]): { date: number; or: number; amount: number; inst: number; remarks: number } | null {
  const lower = headerRow.map((v) => cell(v).toLowerCase());
  let date = -1, or = -1, amount = -1, inst = -1, remarks = -1;
  lower.forEach((h, i) => {
    if (date === -1 && (h.includes("o.r. date") || h.includes("or date") || (h.includes("date") && !h.includes("birth")))) date = i;
  });
  // Second pass for the O.R. number so "O.R. Date" can't hijack it.
  lower.forEach((h, i) => {
    if (i === date) return;
    if (or === -1 && (h.includes("o.r. no") || h.includes("or no") || h.includes("o.r.") || h === "or")) or = i;
    if (amount === -1 && h.includes("amount")) amount = i;
    if (inst === -1 && h.includes("installment") && h.includes("no")) inst = i;
    if (remarks === -1 && h.includes("remarks")) remarks = i;
  });
  if (date === -1 || amount === -1) return null;
  return { date, or, amount, inst, remarks };
}

/**
 * Parse an uploaded CSV / XLSX payment file.
 *
 * Auto-detects between the flat ledger format and the Sprinter-style statement
 * format; returns normalized rows ready for contract-number resolution.
 */
export async function parsePaymentUpload(file: File): Promise<ParseResult> {
  let grid: unknown[][] = [];

  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
  } else {
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
    for (const err of result.errors) {
      if (err.code !== "TooFewFields") throw new Error(`CSV parse error: ${err.message}`);
    }
    grid = result.data;
  }

  if (grid.length === 0) return { rows: [], warnings: ["The file has no data rows."] };

  // ── Detect layout ──────────────────────────────────────────────
  // Scan the first 10 rows for a statement header block ("Contract No.:").
  const head = grid.slice(0, 10).map((row) => (row || []).map(cell).join(" ").toLowerCase());
  const isStatement = head.some((line) => line.includes("contract no") || line.includes("pay class"));

  const rows: ParsedPaymentRow[] = [];
  const warnings: string[] = [];

  if (isStatement) {
    // ── Statement layout: repeat per contract block ─────────────
    let currentContract = "";
    let currentName = "";
    let r = 0;

    while (r < grid.length) {
      const line = (grid[r] || []).map(cell).join(" ").toLowerCase();

      // A new block starts at "Contract No.:"
      if (line.includes("contract no")) {
        const block = extractStatementBlock(grid.slice(r, r + 40));
        if (!block.contractNumber) {
          warnings.push(`Row ${r + 1}: a statement block is missing its contract number — skipped.`);
          r += block.headerRowIdx >= 0 ? block.headerRowIdx + 1 : 1;
          continue;
        }
        currentContract = block.contractNumber;
        currentName = block.name;

        if (block.headerRowIdx >= 0) {
          const cols = mapStatementColumns(grid[r + block.headerRowIdx] || []);
          if (!cols) {
            warnings.push(`Row ${r + 1}: could not read the payment table header for contract ${currentContract} — block skipped.`);
            r += block.headerRowIdx + 1;
            continue;
          }
          // Consume grid rows until a blank separator / next block.
          let pr = r + block.headerRowIdx + 1;
          while (pr < grid.length) {
            const prow = grid[pr] || [];
            const pcell = (i: number) => cell(prow[i]);
            const amount = parseMoney(pcell(cols.amount));
            const dateCell = pcell(cols.date);

            // Stop conditions: an entirely empty row, or the next block.
            const rowJoined = prow.map(cell).join("").trim();
            if (!rowJoined || rowJoined.toLowerCase().includes("contract no")) break;

            const remarksFromPayClass = pcell(0) && !pcell(0).toLowerCase().includes("pay class") ? pcell(0) : "";
            const remark = pcell(cols.remarks) || remarksFromPayClass;
            const installment = cols.inst >= 0 ? pcell(cols.inst) : "";

            if (!isNaN(amount) && amount > 0 && dateCell) {
              rows.push({
                contractNumber: currentContract,
                amount,
                channel: "cash",
                date: dateCell,
                orNumber: cols.or >= 0 ? pcell(cols.or) : "",
                remarks: [remarksFromPayClass, installment ? `Installment ${installment}` : ""].filter(Boolean).join(" · ") || remark,
                fromStatement: true,
              });
            } else if (rowJoined && !isNaN(amount) && amount <= 0) {
              warnings.push(`Row ${pr + 1}: zero/negative amount in contract ${currentContract} — skipped.`);
            }
            pr++;
          }
          r = pr;
          continue;
        } else {
          warnings.push(`Row ${r + 1}: no payment table header found for contract ${currentContract} — block skipped.`);
          r += 1;
          continue;
        }
      }
      r++;
    }
    if (rows.length === 0) {
      warnings.push("No payment rows could be read from the statement layout.");
    }
    void currentName; // Available if the UI wants to show planholder names later.
    return { rows, warnings };
  }

  // ── Flat layout: header row + one payment per row ──────────────
  const headerRowIdx = grid.findIndex((row) => (row || []).some((v) => /contract/i.test(cell(v))));
  if (headerRowIdx === -1) {
    return { rows: [], warnings: ["Could not find a header row containing a contract column."] };
  }

  const headers = (grid[headerRowIdx] || []).map((v) => cell(v));
  const col = (patterns: RegExp[]) => headers.findIndex((h) => patterns.some((p) => p.test(h.toLowerCase())));

  const idxContract = col([/contract/]);
  const idxAmount = col([/^amount$/, /^amt$/]);
  const idxChannel = col([/channel/, /^mode$/, /^payment.?mode$/]);
  const idxDate = col([/date/]);
  const idxOr = col([/o\.?r\.?/, /^or$/, /receipt/]);
  const idxRemarks = col([/remarks?/, /notes?/]);
  const idxName = col([/^name$/, /planholder/]);

  if (idxContract === -1 || idxAmount === -1) {
    return { rows: [], warnings: ["The header row must contain at least a contract and an amount column."] };
  }

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const get = (i: number) => (i >= 0 ? cell(row[i]) : "");
    const contractNumber = get(idxContract) || get(idxName); // fall back to name if contract cell empty
    const amount = parseMoney(get(idxAmount));
    const date = get(idxDate);
    if (!contractNumber || isNaN(amount) || amount <= 0) continue;

    rows.push({
      contractNumber,
      amount,
      channel: normalizeChannel(get(idxChannel)),
      date,
      orNumber: get(idxOr),
      remarks: get(idxRemarks),
      fromStatement: false,
    });
  }

  if (rows.length === 0) warnings.push("No valid payment rows were found in the file.");
  return { rows, warnings };
}
