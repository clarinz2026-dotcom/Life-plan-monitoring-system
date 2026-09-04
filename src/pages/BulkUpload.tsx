import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Trash2,
  FilePlus2,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface UploadRow {
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
  contactNumber: string;
  address: string;
}

interface ValidationResult {
  row: number;
  errors: string[];
}

const HEADER_ALIASES: Record<string, keyof UploadRow> = {
  no: "no",
  number: "no",
  "#": "no",
  planholdername: "planholderName",
  planholder: "planholderName",
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
  "30": "due30",
  "30days": "due30",
  "60": "due60",
  "60days": "due60",
  "90": "due90",
  "90days": "due90",
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

function compactHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9#]/g, "");
}

function mapHeader(header: string): keyof UploadRow | "" {
  return HEADER_ALIASES[compactHeader(header)] || "";
}

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function toUploadRow(row: Record<string, unknown>): UploadRow {
  return {
    no: str(row.no),
    planholderName: str(row.planholderName),
    lpaNo: str(row.lpaNo),
    planType: str(row.planType),
    effectivityDate: str(row.effectivityDate),
    dueDate: str(row.dueDate),
    installment: str(row.installment),
    amount: str(row.amount),
    due30: str(row.due30),
    due60: str(row.due60),
    due90: str(row.due90),
    contactNumber: str(row.contactNumber),
    address: str(row.address),
  };
}

function validateRow(row: UploadRow, rowNum: number): ValidationResult {
  const errors: string[] = [];
  if (!row.planholderName?.trim()) errors.push("Planholder name is required");
  if (row.effectivityDate?.trim()) {
    const date = new Date(row.effectivityDate);
    if (isNaN(date.getTime())) {
      errors.push(`Invalid effectivity date: ${row.effectivityDate}`);
    }
  }
  if (row.installment?.trim()) {
    const months = parseFloat(row.installment);
    if (isNaN(months) || months < 0) {
      errors.push(`Installment (months paid) must be a number: ${row.installment}`);
    }
  }
  if (row.amount?.trim()) {
    const amount = parseFloat(String(row.amount).replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Invalid amount: ${row.amount}`);
    }
  }
  return { row: rowNum, errors };
}

const VALID_FIELDS = Object.values(HEADER_ALIASES);

const peso = (n: number) => `₱${n.toLocaleString()}`;

const planMonthly = (plan: { price: number; monthlyRate?: number }): number => {
  if (plan.monthlyRate && plan.monthlyRate > 0) return plan.monthlyRate;
  if (plan.price > 0 && plan.price % 60 === 0) {
    const legacyMonthly = plan.price / 60;
    if (legacyMonthly >= 50 && legacyMonthly <= 5000) return legacyMonthly;
  }
  return plan.price;
};

export default function BulkUpload() {
  const bulkCreateClients = useMutation(api.bulk.bulkCreateClients);
  const plans = useQuery(api.plans.list) ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<UploadRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [monthlyRates, setMonthlyRates] = useState<Record<number, string>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
    contractsCreated: number;
    paymentsCreated: number;
  } | null>(null);

  const plansByName = useCallback(() => {
    const map = new Map<string, { name: string; price: number; monthlyRate?: number }>();
    for (const p of plans) {
      if (p.isActive === false) continue;
      map.set(p.name.toLowerCase().trim(), p);
    }
    return map;
  }, [plans]);

  const getMatchedPlan = useCallback(
    (row: UploadRow): { name: string; price: number; monthlyRate?: number } | null => {
      const pt = (row.planType || "").trim().toLowerCase();
      if (!pt) return null;
      return plansByName().get(pt) ?? null;
    },
    [plansByName],
  );

  const getSuggestedMonthly = useCallback(
    (row: UploadRow, plan: { price: number; monthlyRate?: number }): number | null => {
      const amount = parseFloat(String(row.amount).replace(/,/g, ""));
      const months = parseInt(row.installment || "", 10) || 0;
      if (!isNaN(amount) && amount > 0 && months > 0) return Math.round(amount / months);
      return planMonthly(plan);
    },
    [],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;
      setFile(selectedFile);
      setParsedData([]);
      setValidationResults([]);
      setMonthlyRates({});
      setUploadResult(null);
      setIsParsing(true);

      try {
        let data: UploadRow[] = [];
        if (selectedFile.name.endsWith(".csv")) {
          const text = await selectedFile.text();
          const result = Papa.parse<Record<string, unknown>>(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: mapHeader,
          });
          data = result.data
            .filter((row) => Object.keys(row).length > 0)
            .map((row) => toUploadRow(row));
        } else if (
          selectedFile.name.endsWith(".xlsx") ||
          selectedFile.name.endsWith(".xls")
        ) {
          const buffer = await selectedFile.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
            worksheet,
            { defval: "" },
          );
          data = jsonData.map((row) => {
            const normalizedRow: Record<string, unknown> = {};
            for (const key of VALID_FIELDS) {
              normalizedRow[key] = "";
            }
            Object.entries(row).forEach(([key, value]) => {
              const field = mapHeader(key);
              if (field) normalizedRow[field] = value;
            });
            return toUploadRow(normalizedRow);
          });
        }
        const results = data.map((row, i) => validateRow(row, i + 1));
        setParsedData(data);
        setValidationResults(results);
      } catch (error) {
        console.error("Failed to parse file:", error);
      } finally {
        setIsParsing(false);
      }
    },
    [],
  );

  const handleUpload = async () => {
    const originalIndices: number[] = [];
    parsedData.forEach((_, i) => {
      const result = validationResults[i];
      if (result && result.errors.length === 0) originalIndices.push(i);
    });

    const validRows = originalIndices.map((origIdx) => {
      const row = parsedData[origIdx];
      const plan = getMatchedPlan(row);
      const months = parseInt(row.installment || "", 10) || 0;
      const amount = parseFloat(String(row.amount).replace(/,/g, ""));
      let monthlyRate: number | undefined;
      if (plan && months > 0 && (isNaN(amount) || amount <= 0)) {
        const v = parseFloat(monthlyRates[origIdx] || "");
        if (!isNaN(v) && v > 0) monthlyRate = v;
      }
      return {
        no: row.no,
        planholderName: row.planholderName,
        lpaNo: row.lpaNo,
        planType: row.planType,
        effectivityDate: row.effectivityDate,
        dueDate: row.dueDate,
        installment: row.installment,
        amount: row.amount,
        due30: row.due30,
        due60: row.due60,
        due90: row.due90,
        contactNumber: row.contactNumber,
        address: row.address,
        selectedPrice: monthlyRate,
      };
    });

    if (validRows.length === 0) return;
    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await bulkCreateClients({ clients: validRows });
      setUploadResult(result);
    } catch (error) {
      console.error("Bulk upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setValidationResults([]);
    setMonthlyRates({});
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validCount = validationResults.filter((r) => r.errors.length === 0).length;
  const errorCount = validationResults.filter((r) => r.errors.length > 0).length;
  const contractCount = parsedData.filter((row) => getMatchedPlan(row)).length;

  const TEMPLATE_HEADERS = [
    "No.", "Planholder Name", "LPA NO", "Plan Type", "Effectivity Date",
    "Due Date", "Installment", "Amount", "30", "60", "90", "Contact No.", "Address",
  ];

  const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const downloadSampleCSV = () => {
    const sampleRow = [
      "1", "Clarins Dela Cruz", "LPA-2025-0123", "Isidore", "01/15/2025",
      "02/15/2025", "3", "750", "", "", "", "09171234567", "123 Rizal Avenue Manila",
    ];
    const csv =
      "\uFEFF" +
      [TEMPLATE_HEADERS, sampleRow]
        .map((cells) => cells.map(csvCell).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_planholders_upload.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Bulk Upload
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import planholders, auto-create contracts for matching plans
        </p>
      </div>

      {/* Instructions */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Format Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            Upload a CSV or XLSX file with the following columns. Column names
            are case-insensitive and ignore spaces/punctuation.{" "}
            <span className="font-semibold text-foreground">Client records</span>{" "}
            are always created; if the <span className="font-semibold text-foreground">Plan Type</span>{" "}
            matches a plan on the <span className="font-semibold text-foreground">Plans</span> page,
            a <span className="font-semibold text-foreground">contract</span> is created automatically
            with backdated payments for the months already paid.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-[13px] font-semibold mb-2 text-green-600">
                Required Columns
              </p>
              <ul className="text-[14px] text-muted-foreground space-y-1.5">
                <li>• Planholder name — Full name</li>
              </ul>
              <p className="text-[13px] font-semibold mt-5 mb-2 text-muted-foreground">
                Contract Columns (used when Plan Type matches a plan)
              </p>
              <ul className="text-[14px] text-muted-foreground space-y-1.5">
                <li>• Plan type — Matches a plan on the Plans page</li>
                <li>• LPA NO — Becomes the contract number</li>
                <li>• Effectivity date — Contract start date</li>
                <li>• Installment — Months already paid (backdated payments)</li>
                <li>
                  • Amount — If filled: each backdated payment = Amount ÷ months.
                  If blank: you pick the monthly rate in the preview
                </li>
              </ul>
              <p className="text-[13px] font-semibold mt-5 mb-2 text-muted-foreground">
                Reference Columns (kept on the client)
              </p>
              <ul className="text-[14px] text-muted-foreground space-y-1.5">
                <li>• No. — Row number</li>
                <li>• Contact No. — Phone number (optional)</li>
                <li>• Address — Complete address (optional)</li>
                <li>• Due date — Payment due reference</li>
                <li>• 30 / 60 / 90 — Aging reference amounts</li>
              </ul>
            </div>

            <div>
              <p className="text-[13px] font-semibold mb-2 text-muted-foreground">
                Example
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-[13px] text-muted-foreground space-y-1.5 overflow-x-auto">
                <div className="text-green-600 font-medium whitespace-nowrap">
                  No., Planholder Name, LPA NO, Plan Type, Effectivity Date,
                  Due Date, Installment, Amount, 30, 60, 90, Contact No.,
                  Address
                </div>
                <div className="whitespace-nowrap">
                  1, Clarins Dela Cruz, LPA-2025-0123, Isidore, 01/15/2025,
                  02/15/2025, 3, 750, , , , 09171234567, 123 Rizal Avenue Manila
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-3">
                Date format: MM/DD/YYYY or YYYY-MM-DD. Amounts may include
                commas (e.g. 150,000).
              </p>
              <p className="text-[13px] text-muted-foreground mt-2">
                If a plan type doesn't match any plan on the Plans page, the
                client is still imported without a contract.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              size="default"
              className="gap-2 h-10 text-[14px]"
              onClick={downloadSampleCSV}
            >
              <Download className="h-4 w-4" />
              Download Sample CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <Label className="text-[14px]">Select File (CSV or XLSX)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="text-base mt-1.5"
                disabled={isParsing}
              />
            </div>

            {isParsing && (
              <div className="flex items-center gap-2 text-[15px] text-muted-foreground">
                <div className="h-5 w-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                Parsing file...
              </div>
            )}

            {file && !isParsing && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <FileText className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">{file.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • {parsedData.length} rows
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-muted-foreground hover:text-foreground h-9"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview & Validation */}
      {parsedData.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className="text-[12px] terminal-status-current"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              {validCount} valid
            </Badge>
            {errorCount > 0 && (
              <Badge
                variant="outline"
                className="text-[12px] terminal-status-claim"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                {errorCount} errors
              </Badge>
            )}
            {contractCount > 0 && (
              <Badge variant="outline" className="text-[12px]">
                <FilePlus2 className="h-3.5 w-3.5 mr-1.5" />
                {contractCount} contract{contractCount !== 1 ? "s" : ""} will be created
              </Badge>
            )}
            <Button
              onClick={handleUpload}
              disabled={validCount === 0 || isUploading}
              className="gap-2 h-11 px-5 text-[15px]"
            >
              {isUploading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {validCount} record{validCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold">
                Preview ({parsedData.length} rows)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-[14px] min-w-[1700px]">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "No.", "Status", "Planholder Name", "LPA NO", "Plan Type",
                      "Contract", "Effectivity Date", "Due Date", "Installment",
                      "Monthly (₱)", "Amount", "30", "60", "90", "Contact No.",
                      "Address", "Errors",
                    ].map((header) => (
                      <th
                        key={header}
                        className="text-left py-3 px-3 text-[13px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 100).map((row, i) => {
                    const result = validationResults[i];
                    const hasErrors = result && result.errors.length > 0;
                    const amountNum = parseFloat(String(row.amount).replace(/,/g, ""));
                    const plan = getMatchedPlan(row);
                    const months = parseInt(row.installment || "", 10) || 0;
                    const hasAmount = !isNaN(amountNum) && amountNum > 0;
                    const suggested = plan ? getSuggestedMonthly(row, plan) : null;
                    const needsMonthlyInput =
                      !!plan && months > 0 && !hasAmount && suggested !== null;
                    const monthlyDisplay = monthlyRates[i] ?? (suggested !== null ? String(suggested) : "");
                    return (
                      <tr
                        key={i}
                        className={`border-b border-border/30 last:border-0 ${
                          hasErrors ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="py-3 px-3 text-[13px] text-muted-foreground">
                          {row.no || i + 1}
                        </td>
                        <td className="py-3 px-3">
                          {hasErrors ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                        </td>
                        <td className="py-3 px-3 text-[14px] whitespace-nowrap">
                          {row.planholderName}
                        </td>
                        <td className="py-3 px-3 text-[13px] whitespace-nowrap">
                          {row.lpaNo || "—"}
                        </td>
                        <td className="py-3 px-3 text-[14px] whitespace-nowrap">
                          {row.planType || "—"}
                        </td>
                        <td className="py-3 px-3">
                          {plan ? (
                            <Badge variant="outline" className="text-[12px] terminal-status-current whitespace-nowrap">
                              {plan.name} · {peso(planMonthly(plan))}/mo
                            </Badge>
                          ) : (
                            <span className="text-[12px] text-muted-foreground whitespace-nowrap">
                              client only
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[13px] whitespace-nowrap">
                          {row.effectivityDate || "—"}
                        </td>
                        <td className="py-3 px-3 text-[13px] whitespace-nowrap">
                          {row.dueDate || "—"}
                        </td>
                        <td className="py-3 px-3 text-[13px] text-right">
                          {row.installment || "—"}
                        </td>
                        <td className="py-3 px-3">
                          {needsMonthlyInput ? (
                            <Input
                              type="number"
                              value={monthlyDisplay}
                              onChange={(e) =>
                                setMonthlyRates((prev) => ({ ...prev, [i]: e.target.value }))
                              }
                              placeholder="Monthly ₱"
                              className="h-8 w-28 text-[13px]"
                            />
                          ) : plan && months > 0 ? (
                            <span className="text-[13px] text-green-600 font-medium whitespace-nowrap">
                              {suggested !== null ? peso(suggested) : "—"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[13px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[13px] text-right whitespace-nowrap">
                          {hasAmount ? peso(amountNum) : row.amount || "—"}
                        </td>
                        <td className="py-3 px-3 text-[13px] text-right">
                          {row.due30 || "—"}
                        </td>
                        <td className="py-3 px-3 text-[13px] text-right">
                          {row.due60 || "—"}
                        </td>
                        <td className="py-3 px-3 text-[13px] text-right">
                          {row.due90 || "—"}
                        </td>
                        <td className="py-3 px-3 text-[13px] whitespace-nowrap">
                          {row.contactNumber || "—"}
                        </td>
                        <td className="py-3 px-3 text-[13px] max-w-[200px] truncate">
                          {row.address || "—"}
                        </td>
                        <td className="py-3 px-3">
                          {hasErrors && (
                            <div className="text-[12px] text-red-600">
                              {result.errors.map((e, j) => (
                                <div key={j}>• {e}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedData.length > 100 && (
                <div className="p-4 text-center text-[13px] text-muted-foreground border-t border-border">
                  Showing 100 of {parsedData.length} rows
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {uploadResult.failed === 0 ? (
                  <CheckCircle className="h-10 w-10 text-green-600" />
                ) : (
                  <AlertTriangle className="h-10 w-10 text-amber-600" />
                )}
                <div>
                  <h3 className="text-xl font-bold">Upload Complete</h3>
                  <p className="text-[15px] text-muted-foreground mt-0.5">
                    {uploadResult.success} client{uploadResult.success !== 1 ? "s" : ""} created
                    {uploadResult.failed > 0 && `, ${uploadResult.failed} failed`}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="text-[12px] terminal-status-current">
                      {uploadResult.contractsCreated} contract{uploadResult.contractsCreated !== 1 ? "s" : ""} created
                    </Badge>
                    <Badge variant="outline" className="text-[12px]">
                      {uploadResult.paymentsCreated} backdated payment{uploadResult.paymentsCreated !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-red-600">Errors:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {uploadResult.errors.map((err, i) => (
                      <div key={i} className="text-[13px] text-red-600">
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={handleReset} className="h-11 text-[14px]">
                Upload Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
