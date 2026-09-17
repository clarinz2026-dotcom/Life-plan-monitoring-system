import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Shared parser for the bulk payment upload (CSV / XLSX).
 *
 * Two layouts are accepted; the statement layout is always attempted first
 * (across every sheet and every row), and the flat ledger is the fallback:
 *
 * 1. Flat ledger — one header row, one payment per row:
 *      contractNumber, amount, channel, date, orNumber, remarks
 *
 * 2. Sprinter-style statement — the old system's export. A header block of
 *    `Label: value` lines identifies the plan (Contract No., Name, Branch,
 *    Plan Type, ...), followed by a payment grid:
 *      Pay Class | O.R. Date | O.R. No. | Amount | Installment No. | Balance | Remarks
 *    Files may repeat blocks for several contracts, and the block may sit
 *    any number of rows down or on any sheet of the workbook.
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

type Grid = unknown[][];
interface SheetGrid {
  name: string;
  grid: Grid;
}

const VALID_CHANNELS = new Set(["cash", "gcash", "maya", "bank_transfer", "check"]);

/** Normalize a spreadsheet cell to a trimmed string (numbers included). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Parse a date cell into an ISO date string (YYYY-MM-DD).
 * Accepts ISO, MM/DD/YYYY, "17-Dec-2025", and XLSX serial numbers.
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

/** A plausible contract number: a short code without spaces. Rejects things like "O.R. Date". */
function looksLikeContractNumber(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= 20 && !v.includes(" ") && /^[A-Za-z0-9][A-Za-z0-9\-\/\.\#]*$/.test(v);
}

/** Read every non-empty sheet of an XLSX workbook (or the CSV text) as a grid. */
async function readGrids(file: File): Promise<SheetGrid[]> {
  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheets: SheetGrid[] = [];
    for (const name of workbook.SheetNames) {
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
      }) as unknown[][];
      if (grid.length > 0) sheets.push({ name, grid });
    }
    return sheets;
  }
  const text = await file.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
  for (const err of result.errors) {
    if (err.code !== "TooFewFields") throw new Error(`CSV parse error: ${err.message}`);
  }
  return [{ name: file.name, grid: result.data }];
}

/** True when a row looks like the statement payment-grid header (O.R. + Amount). */
function isPaymentGridHeader(row: unknown[]): boolean {
  const joined = row.map((v) => cell(v).toLowerCase()).join("|");
  const hasOr = joined.includes("o.r") || joined.includes("or date") || joined.includes("or no");
  return hasOr && joined.includes("amount");
}

/** Locate the Date / O.R. No. / Amount / Installment / Remarks column offsets in a grid header. */
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
 * Starting at a row that mentions "contract", read the `Label: value` block
 * above the payment grid and locate the grid header row.
 */
function extractStatementBlock(grid: Grid, startRow: number): { contractNumber: string; headerRowIdx: number } {
  let contractNumber = "";
  let headerRowIdx = -1;
  const end = Math.min(grid.length, startRow + 60);

  for (let r = startRow; r < end; r++) {
    const row = grid[r] || [];

    // Payment grid header row: contains both an O.R. column and Amount.
    if (headerRowIdx === -1 && isPaymentGridHeader(row)) {
      headerRowIdx = r;
      break; // The block above is complete.
    }

    for (let c = 0; c < row.length; c++) {
      const raw = cell(row[c]);
      const lower = raw.toLowerCase();
      if (!lower) continue;

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

      // Contract identifier: "Contract No.: 014101" / "Contract Number"
      if (!contractNumber && lower.startsWith("contract")) {
        const value = valueOf();
        if (looksLikeContractNumber(value)) contractNumber = value;
      }
    }
  }

  return { contractNumber, headerRowIdx };
}

/** Parse one sheet in the Sprinter statement layout. Empty result = not a statement sheet. */
function parseStatementGrid(sheet: SheetGrid): ParseResult {
  const { name, grid } = sheet;
  const rows: ParsedPaymentRow[] = [];
  const warnings: string[] = [];

  let r = 0;
  while (r < grid.length) {
    const row = grid[r] || [];
    const contractCellIdx = row.findIndex((c) => cell(c).toLowerCase().startsWith("contract"));
    if (contractCellIdx === -1) {
      r++;
      continue;
    }

    const block = extractStatementBlock(grid, r);
    if (!block.contractNumber) {
      // Mentions "contract" but isn't a statement block (e.g. a flat-table
      // header row) — skip silently so the flat fallback can take over.
      r++;
      continue;
    }
    if (block.headerRowIdx === -1) {
      warnings.push(`${name}: found contract ${block.contractNumber} but no payment table below it — block skipped.`);
      r++;
      continue;
    }

    const cols = mapStatementColumns(grid[block.headerRowIdx] || []);
    if (!cols) {
      warnings.push(`${name}: could not read the payment table header for contract ${block.contractNumber} — block skipped.`);
      r += block.headerRowIdx - r + 1;
      continue;
    }

    // Consume payment rows until a blank separator or the next contract block.
    let pr = block.headerRowIdx + 1;
    while (pr < grid.length) {
      const prow = grid[pr] || [];
      const pcell = (i: number) => cell(prow[i]);
      const rowJoined = prow.map(cell).join("").trim();
      if (!rowJoined || prow.some((c) => cell(c).toLowerCase().startsWith("contract"))) break;

      const amount = parseMoney(pcell(cols.amount));
      const dateCell = pcell(cols.date);
      if (!isNaN(amount) && amount > 0 && dateCell) {
        const payClass = pcell(0) && !pcell(0).toLowerCase().includes("pay class") ? pcell(0) : "";
        const installment = cols.inst >= 0 ? pcell(cols.inst) : "";
        const remark = pcell(cols.remarks);
        rows.push({
          contractNumber: block.contractNumber,
          amount,
          channel: "cash",
          date: dateCell,
          orNumber: cols.or >= 0 ? pcell(cols.or) : "",
          remarks: [payClass, installment ? `Installment ${installment}` : "", remark].filter(Boolean).join(" · "),
          fromStatement: true,
        });
      } else if (rowJoined && !isNaN(amount) && amount <= 0 && dateCell) {
        warnings.push(`${name} row ${pr + 1}: zero/negative amount for contract ${block.contractNumber} — skipped.`);
      }
      pr++;
    }
    r = pr;
  }

  return { rows, warnings };
}

/** Parse one sheet in the flat ledger layout (header row + one payment per row). */
function parseFlatGrid(sheet: SheetGrid): ParseResult {
  const { name, grid } = sheet;
  const rows: ParsedPaymentRow[] = [];

  // The header row must mention both contract and amount so a label row
  // ("Contract No.: 014101 … Plan Value …") can't be mistaken for it.
  const headerRowIdx = grid.findIndex(
    (row) =>
      (row || []).some((v) => /contract/i.test(cell(v))) &&
      (row || []).some((v) => /amount|amt/i.test(cell(v))),
  );
  if (headerRowIdx === -1) {
    return { rows: [], warnings: [`${name}: no header row with Contract and Amount columns was found.`] };
  }

  const headers = (grid[headerRowIdx] || []).map((v) => cell(v));
  const col = (patterns: RegExp[]) => headers.findIndex((h) => patterns.some((p) => p.test(h.toLowerCase())));

  const idxContract = col([/contract/]);
  const idxAmount = col([/^amount$/, /^amt$/, /^amount/]);
  const idxChannel = col([/channel/, /^mode$/, /payment.?mode/]);
  const idxDate = col([/date/]);
  const idxOr = col([/o\.?r\.?/, /^or$/, /receipt/]);
  const idxRemarks = col([/remarks?/, /notes?/]);

  if (idxContract === -1 || idxAmount === -1) {
    return {
      rows: [],
      warnings: [
        `${name}: the header row must contain at least a contract and an amount column. Found: ${headers.filter(Boolean).join(", ") || "(none)"}`,
      ],
    };
  }

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const get = (i: number) => (i >= 0 ? cell(row[i]) : "");
    const contractNumber = get(idxContract);
    const amount = parseMoney(get(idxAmount));
    if (!contractNumber || isNaN(amount) || amount <= 0) continue;

    rows.push({
      contractNumber,
      amount,
      channel: normalizeChannel(get(idxChannel)),
      date: get(idxDate),
      orNumber: get(idxOr),
      remarks: get(idxRemarks),
      fromStatement: false,
    });
  }

  return { rows, warnings: [] };
}

/**
 * Parse an uploaded CSV / XLSX payment file.
 *
 * Tries the Sprinter statement layout first (every sheet, every row); if that
 * finds nothing, falls back to the flat ledger layout.
 */
export async function parsePaymentUpload(file: File): Promise<ParseResult> {
  const sheets = await readGrids(file);
  if (sheets.length === 0) return { rows: [], warnings: ["The file has no data rows."] };

  const statementResults = sheets.map(parseStatementGrid);
  const statementRows = statementResults.flatMap((r) => r.rows);
  if (statementRows.length > 0) {
    return { rows: statementRows, warnings: statementResults.flatMap((r) => r.warnings) };
  }

  const flatResults = sheets.map(parseFlatGrid);
  const flatRows = flatResults.flatMap((r) => r.rows);
  if (flatRows.length > 0) {
    return { rows: flatRows, warnings: flatResults.flatMap((r) => r.warnings) };
  }

  const flatWarnings = flatResults.flatMap((r) => r.warnings);
  return {
    rows: [],
    warnings: flatWarnings.length > 0
      ? flatWarnings
      : ["No payment rows could be read. Expected a statement export (Contract No. block + Pay Class / O.R. Date / O.R. No. / Amount table) or a flat table with Contract and Amount columns."],
  };
}
