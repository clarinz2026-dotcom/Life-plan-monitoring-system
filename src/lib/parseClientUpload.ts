import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Shared parser for the bulk CLIENT upload (CSV / XLSX).
 *
 * Two layouts are accepted, auto-detected per file:
 *
 * 1. Flat template — one header row, one planholder per row:
 *      No., Planholder Name, LPA NO, Plan Type, Effectivity Date, Due Date,
 *      Installment, Amount, 30, 60, 90, Contact No., Address
 *
 * 2. "Monthly Collection Performance Report" export — the old system's sheet.
 *    Letterhead + title block (EVANGELIST FUNERAL SERVICES OPC, branch name,
 *    `_____ TO _____, 2026`) sit above the real header row:
 *      No. | Plan Holder's Name | LPA No. | Plan Type | Effectivity | Ins |
 *      Amount | Non-Comm | 30 Days | 60 Days | 90 Days | OR # | Contact No. | Address
 *    The header row may appear anywhere in the sheet; leading/trailing
 *    junk rows are ignored.
 */

export interface ParsedClientRow {
  no: string;
  planholderName: string;
  lpaNo: string;
  planType: string;
  effectivityDate: string;
  dueDate: string;
  installment: string;
  amount: string;
  due30: string;
  due60: string;
  due90: string;
  nonComm: string;
  orNumber: string;
  contactNumber: string;
  address: string;
}

export interface ParseResult {
  rows: ParsedClientRow[];
  warnings: string[];
}

type Grid = unknown[][];

/**
 * Column aliases — compacted header → UploadRow key. Shared shape with the
 * page's UploadRow; every report-format column has a home here.
 */
const HEADER_ALIASES: Record<string, keyof ParsedClientRow> = {
  no: "no",
  number: "no",
  "#": "no",
  planholdersname: "planholderName",
  planholder: "planholderName",
  planholders: "planholderName",
  planholdername: "planholderName",
  clientname: "planholderName",
  name: "planholderName",
  fullname: "planholderName",
  lpano: "lpaNo",
  lpa: "lpaNo",
  lpanumber: "lpaNo",
  contractnumber: "lpaNo",
  contractno: "lpaNo",
  plantype: "planType",
  plan: "planType",
  type: "planType",
  effectivitydate: "effectivityDate",
  effectivity: "effectivityDate",
  startdate: "effectivityDate",
  duedate: "dueDate",
  due: "dueDate",
  paymentduedate: "dueDate",
  installment: "installment",
  installments: "installment",
  monthspaid: "installment",
  ins: "installment",
  insinstallment: "installment",
  insinstallments: "installment",
  amount: "amount",
  planamount: "amount",
  total: "amount",
  noncomm: "nonComm", // reference-only column → kept as reference on the client
  noncommt: "nonComm",
  "30": "due30",
  "30days": "due30",
  "60": "due60",
  "60days": "due60",
  "90": "due90",
  "90days": "due90",
  or: "orNumber",
  orno: "orNumber",
  ornum: "orNumber",
  ornumber: "orNumber",
  orhash: "orNumber",
  contactnumber: "contactNumber",
  contactno: "contactNumber",
  contact: "contactNumber",
  phonenumber: "contactNumber",
  phone: "contactNumber",
  mobile: "contactNumber",
  address: "address",
  completeaddress: "address",
  fulladdress: "address",
  homeaddress: "address",
};

/** Normalize a header cell for alias lookup: lowercase, strip punctuation. */
export function compactHeader(header: string): string {
  return String(header).trim().toLowerCase().replace(/[^a-z0-9#]/g, "");
}

function mapHeader(header: string): keyof ParsedClientRow | "" {
  return HEADER_ALIASES[compactHeader(header)] || "";
}

/** Normalize a spreadsheet cell to a trimmed string (numbers included). */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Parse a date cell into an ISO date string (YYYY-MM-DD).
 * Accepts ISO, MM/DD/YYYY, DD/MM/YYYY (ambiguous → MM/DD first), "22-Feb-2022",
 * "8-Jun-2022", and XLSX serial numbers.
 */
export function parseClientUploadDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // XLSX serial date (days since 1899-12-30), e.g. 44609
  if (/^\d{5}(\.\d+)?$/.test(value)) {
    const serial = parseFloat(value);
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  // 22-Feb-2022 / 22 February 2022
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

  // MM/DD/YYYY or MM-DD-YYYY (US order, the app's display format)
  const mdy = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.split("T")[0];

  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? null : fallback.toISOString().split("T")[0];
}

/**
 * Match a contract/LPA number from a file against the system's stored numbers,
 * forgivingly: exact → trimmed → leading-zero-insensitive (Excel strips the
 * leading zero when "0000511" is stored as the number 511) → digits-only.
 * Returns the system's original number, or undefined.
 */
export function matchContractNumber(
  knownNumbers: string[],
  value: string,
): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;

  const byExact = new Map(knownNumbers.map((n) => [n.toLowerCase(), n]));
  const hit = byExact.get(raw.toLowerCase());
  if (hit) return hit;

  const norm = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");
  const canon = (s: string) => {
    const n = norm(s).toLowerCase();
    return /^\d+$/.test(n) ? n.replace(/^0+(?=\d)/, "") : n;
  };

  const target = canon(raw);
  if (!target) return undefined;
  return knownNumbers.find((n) => canon(n) === target);
}

/**
 * Read a spreadsheet as a grid of raw strings. `raw: false` gives formatted
 * cell text — date cells read "22-Feb-2022" not serial numbers, currency as
 * "₱350.00" — and text-formatted LPA numbers keep their leading zeros.
 */
async function readGrid(file: File): Promise<{ grid: Grid; source: string }> {
  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    for (const name of workbook.SheetNames) {
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];
      // Use the first sheet that actually contains data rows.
      if (grid.length > 1) return { grid, source: name };
    }
    const first = workbook.SheetNames[0];
    const grid = first
      ? (XLSX.utils.sheet_to_json(workbook.Sheets[first], { header: 1, defval: "", raw: false }) as unknown[][])
      : [];
    return { grid, source: first || file.name };
  }
  const text = await file.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
  for (const err of result.errors) {
    if (err.code !== "TooFewFields") throw new Error(`CSV parse error: ${err.message}`);
  }
  return { grid: result.data, source: file.name };
}

/** Locate the header row: the first row where ≥4 cells resolve to known columns. */
function findHeaderRow(grid: Grid): number {
  for (let r = 0; r < Math.min(grid.length, 50); r++) {
    const row = grid[r] || [];
    const hits = row.filter((h) => mapHeader(cell(h)) !== "").length;
    if (hits >= 4) return r;
    // A row of "No. | Plan Holder's Name | LPA No. | Plan Type | Effectivity | Ins"
    // may have wrapped/styled headers; fall back to a strong prefix match.
    const prefix = row
      .slice(0, 6)
      .filter((h) => /plan.?holder|planholder|lpa|plantype|effectivity|ins\b/i.test(cell(h)))
      .length;
    if (prefix >= 3) return r;
  }
  return -1;
}

/**
 * Parse an uploaded CSV / XLSX client file.
 *
 * Accepts both the flat template and the "Monthly Collection Performance
 * Report" layout; the header row is located wherever it sits below any
 * letterhead/title block.
 */
export async function parseClientUpload(file: File): Promise<ParseResult> {
  const { grid, source } = await readGrid(file);
  if (grid.length === 0) return { rows: [], warnings: ["The file has no data rows."] };

  const headerRowIdx = findHeaderRow(grid);
  if (headerRowIdx === -1) {
    return {
      rows: [],
      warnings: [
        `${source}: could not find a header row. Expected columns like "Plan Holder's Name", "LPA No.", "Plan Type", "Effectivity", "Ins", "Amount"…`,
      ],
    };
  }

  const headers = (grid[headerRowIdx] || []).map((v) => String(cell(v)));
  const colIdx = headers.map((h) => mapHeader(h));
  const has = (field: keyof ParsedClientRow) => colIdx.includes(field);

  const rows: ParsedClientRow[] = [];
  const warnings: string[] = [];

  if (!has("planholderName")) {
    return { rows: [], warnings: [`${source}: no name column found in the header row.`] };
  }

  const idx = (field: keyof ParsedClientRow) => colIdx.indexOf(field);
  const iNo = idx("no");
  const iName = idx("planholderName");
  const iLpa = idx("lpaNo");
  const iPlan = idx("planType");
  const iEff = idx("effectivityDate");
  const iDue = idx("dueDate");
  const iNonComm = idx("nonComm");
  const iIns = idx("installment");
  const iAmount = idx("amount");
  const i30 = idx("due30");
  const i60 = idx("due60");
  const i90 = idx("due90");
  const iOr = idx("orNumber");
  const iContact = idx("contactNumber");
  const iAddr = idx("address");

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const get = (i: number) => (i >= 0 ? cell(row[i]) : "");

    const name = get(iName);
    const lpaNo = get(iLpa);

    // End of data: an entirely blank row, or a repeated title/letterhead block.
    const joined = row.map(cell).join("").trim();
    if (!joined) continue;
    if (!name) continue;

    // Guard: a stray repeated header row or title block ("Page 2", "CONFIDENTIAL")
    if (/page \d|confidential/i.test(joined)) continue;

    // Skip rows where the "name" column is actually part of a title block
    // (e.g. the letterhead's company name sitting directly above the header).
    if (/evangelist|statement of account|performance report/i.test(name) && r < headerRowIdx) continue;

    rows.push({
      no: get(iNo),
      planholderName: name,
      lpaNo,
      planType: get(iPlan),
      effectivityDate: get(iEff),
      dueDate: get(iDue),
      installment: get(iIns),
      amount: get(iAmount),
      due30: get(i30),
      due60: get(i60),
      due90: get(i90),
      nonComm: get(iNonComm),
      orNumber: get(iOr),
      contactNumber: get(iContact),
      address: get(iAddr),
    });
  }

  if (rows.length === 0) {
    warnings.push(`${source}: no planholder rows could be read below the header.`);
  }
  return { rows, warnings };
}
