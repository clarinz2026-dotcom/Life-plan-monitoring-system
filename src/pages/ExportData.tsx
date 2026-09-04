import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  Users,
  FileText,
  CreditCard,
  Receipt,
  Loader2,
} from "lucide-react";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Render a date field safely; returns "" for missing/invalid values. */
function fmtDate(value?: number | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

/** True when the app is running inside an embedded/cross-origin frame. */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Accessing window.top throws for cross-origin frames.
    return true;
  }
}

/** Save a Blob to the user's machine via a download anchor. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

export default function ExportData() {
  const [exporting, setExporting] = useState(false);

  const clients = useQuery(api.clients.list, {});
  const contracts = useQuery(api.contracts.list, {});
  const payments = useQuery(api.payments.list, {});
  const receipts = useQuery(api.receipts.list, {});

  const handleExportAll = async () => {
    if (exporting) return;

    // Queries are still loading — exporting now would produce empty sheets.
    if (
      clients === undefined ||
      contracts === undefined ||
      payments === undefined ||
      receipts === undefined
    ) {
      toast.info("Data is still loading — please try again in a moment.");
      return;
    }

    setExporting(true);
    try {
      // Clients sheet
      const clientRows = [
        ["Client Export"],
        ["Generated", new Date().toLocaleString()],
        [""],
        [
          "First Name", "Last Name", "Middle Name", "Contact", "Email",
          "Address", "City", "Province", "Zip", "Beneficiary", "Relationship",
        ],
        ...(clients.map((c) => [
          c.firstName, c.lastName, c.middleName || "", c.contactNumber || "",
          c.email || "", c.address || "", c.city, c.province, c.zipCode,
          c.beneficiaryName, c.beneficiaryRelationship,
        ]) || []),
      ];

      // Contracts sheet
      const contractRows = [
        ["Contract Export"],
        ["Generated", new Date().toLocaleString()],
        [""],
        [
          "Contract #", "Client ID", "Plan Type", "Plan Amount", "Monthly",
          "Total Paid", "Balance", "Status", "Start Date", "Maturity Date",
        ],
        ...(contracts.map((c) => [
          c.contractNumber, c.clientId, c.planType, c.planAmount,
          c.monthlyAmortization, c.totalPaid ?? 0,
          Number(c.planAmount) - Number(c.totalPaid ?? 0),
          c.contractStatus,
          fmtDate(c.startDate),
          c.maturityDate ? fmtDate(c.maturityDate) : "",
        ]) || []),
      ];

      // Payments sheet
      const paymentRows = [
        ["Payment Export"],
        ["Generated", new Date().toLocaleString()],
        [""],
        ["OR #", "Contract #", "Amount", "Channel", "Date", "Reference", "Remarks"],
        ...(payments.map((p) => [
          p.orNumber || "", p.contractId, formatPHP(p.amount),
          p.paymentChannel, fmtDate(p.paymentDate),
          p.referenceNumber || p.chequeNumber || "", p.remarks || "",
        ]) || []),
      ];

      // Receipts sheet
      const receiptRows = [
        ["Receipt Export"],
        ["Generated", new Date().toLocaleString()],
        [""],
        [
          "Receipt #", "Contract #", "Amount", "Channel", "Issued To",
          "Plan Type", "Status", "Date",
        ],
        ...(receipts.map((r) => [
          r.receiptNumber, r.contractNumber, formatPHP(r.amount),
          r.paymentChannel, r.issuedTo, r.planType, r.status,
          r.createdAt ? fmtDate(r.createdAt) : "",
        ]) || []),
      ];

      const wb = XLSX.utils.book_new();

      const wsClients = XLSX.utils.aoa_to_sheet(clientRows);
      wsClients["!cols"] = [
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
        { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 20 }, { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(wb, wsClients, "Clients");

      const wsContracts = XLSX.utils.aoa_to_sheet(contractRows);
      wsContracts["!cols"] = [
        { wch: 16 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, wsContracts, "Contracts");

      const wsPayments = XLSX.utils.aoa_to_sheet(paymentRows);
      wsPayments["!cols"] = [
        { wch: 16 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
        { wch: 22 }, { wch: 24 },
      ];
      XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");

      const wsReceipts = XLSX.utils.aoa_to_sheet(receiptRows);
      wsReceipts["!cols"] = [
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
        { wch: 16 }, { wch: 16 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, wsReceipts, "Receipts");

      const data = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      const blob = new Blob([data], { type: XLSX_MIME });

      const filename = `Evangelist_Funeral_Services_Export_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      saveBlob(blob, filename);

      const total =
        clients.length + contracts.length + payments.length + receipts.length;
      toast.success(`Exported ${total.toLocaleString()} records as ${filename}`);

      // Sandboxed/embedded previews (e.g. inside a builder panel) can silently
      // block file downloads. Give the user a hint so it never looks like a dead click.
      if (isEmbedded()) {
        toast.info(
          "If the download did not start, your preview may be blocking file downloads — open the app in a new tab and export again.",
          { duration: 8000 }
        );
      }
    } catch (err) {
      console.error("Export failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Could not create the export file."
      );
    } finally {
      setExporting(false);
    }
  };

  const datasets = [
    { label: "Clients", icon: Users, count: clients?.length ?? 0, color: "text-terminal-green" },
    { label: "Contracts", icon: FileText, count: contracts?.length ?? 0, color: "text-blue-600" },
    { label: "Payments", icon: CreditCard, count: payments?.length ?? 0, color: "text-terminal-amber" },
    { label: "Receipts", icon: Receipt, count: receipts?.length ?? 0, color: "text-purple-600" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded bg-terminal-green/10 flex items-center justify-center">
          <Download className="h-5 w-5 text-terminal-green" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Export Data</h1>
          <p className="text-xs text-muted-foreground font-mono">
            Download your entire database as Excel
          </p>
        </div>
      </div>

      {/* Data Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {datasets.map((d) => (
          <Card key={d.label}>
            <CardContent className="p-4 text-center">
              <d.icon className={`h-6 w-6 mx-auto mb-2 ${d.color}`} />
              <p className={`text-2xl font-bold ${d.color}`}>{d.count}</p>
              <p className="text-xs text-muted-foreground font-mono">{d.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Button */}
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <Download className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <div>
            <p className="text-sm font-mono font-medium">Export All Data</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Downloads an Excel file with separate sheets for Clients, Contracts, Payments, and Receipts
            </p>
          </div>
          <Button
            onClick={handleExportAll}
            disabled={exporting}
            className="gap-2 font-mono min-w-44"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing file…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Download XLSX
              </>
            )}
          </Button>
          {exporting && (
            <p className="text-xs text-muted-foreground font-mono">
              Building workbook from {datasets.reduce((s, d) => s + d.count, 0).toLocaleString()} records…
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
