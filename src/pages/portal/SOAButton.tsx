import { useRef, useState, type ComponentProps } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { generateSOAPDF } from "@/lib/generateSOA";
import { generateSOAHTML, type SOAData } from "@/components/SOADocument";
import type { Doc } from "@/convex/_generated/dataModel";

export type PortalContractDetail = {
  contract: Doc<"contracts">;
  payments: Doc<"payments">[];
  schedules: Doc<"payment_schedules">[];
  receipts: Doc<"receipts">[];
};

export type PortalRecordGroup = {
  client: Doc<"clients">;
  contracts: PortalContractDetail[];
};

/** Build a Statement of Account from portal overview records (all linked planholders). */
export function buildSOAData(
  records: PortalRecordGroup[],
  branchName?: string
): SOAData | null {
  if (records.length === 0) return null;
  const client = records[0].client;
  const fullName = `${client.lastName}, ${client.firstName}${
    client.middleName ? ` ${client.middleName}` : ""
  }`;

  const contracts = records.flatMap((g) =>
    g.contracts.map((cd) => ({
      contractNumber: cd.contract.contractNumber,
      planType: cd.contract.planType,
      planAmount: cd.contract.planAmount,
      monthlyAmortization: cd.contract.monthlyAmortization,
      totalPaid: cd.contract.totalPaid,
      contractStatus: cd.contract.contractStatus,
      startDate: cd.contract.startDate,
    }))
  );

  const payments = records.flatMap((g) =>
    g.contracts.flatMap((cd) =>
      cd.payments.map((p) => ({
        paymentDate: p.paymentDate,
        amount: p.amount,
        paymentChannel: p.paymentChannel,
        orNumber: p.orNumber ?? undefined,
        contractNumber: cd.contract.contractNumber,
        remarks: p.remarks ?? undefined,
      }))
    )
  );

  return {
    clientName: fullName,
    clientAddress:
      [client.address, client.city, client.province].filter(Boolean).join(", ") || "—",
    clientContact: client.contactNumber || "—",
    clientEmail: client.email || undefined,
    beneficiaryName: client.beneficiaryName,
    beneficiaryRelationship: client.beneficiaryRelationship,
    branchName,
    clientBirthDate: client.dateOfBirth
      ? new Date(client.dateOfBirth).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : undefined,
    contracts,
    payments,
    generatedDate: new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    accountNumber: client._id,
  };
}

/**
 * Self-service Statement of Account for the client portal:
 * opens an on-screen preview (so clients can always *see* it), with
 * Download PDF and Print / Save-as-PDF actions.
 */
export function SOAButton({
  records,
  label = "Statement of Account",
  variant = "outline",
  size = "default",
  className,
}: {
  records: PortalRecordGroup[];
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const branches = useQuery(api.branches.list);
  const branchName =
    records.length === 1 && records[0].client.branchId
      ? branches?.find((b) => b._id === records[0].client.branchId)?.name
      : undefined;

  const data = buildSOAData(records, branchName);

  const handleOpen = () => {
    if (!data) {
      toast.error("No linked plan records yet", {
        description:
          "Once your plan is linked to this account your statement will appear here — or ask the office to email you a copy.",
      });
      return;
    }
    setOpen(true);
  };

  const handleDownload = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      await generateSOAPDF(data);
      toast.success("Statement of Account downloaded");
    } catch (err) {
      console.error("Failed to generate SOA PDF:", err);
      toast.error("Could not generate the PDF", {
        description:
          err instanceof Error
            ? err.message
            : "Use Print instead to save a copy as a PDF.",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const frame = frameRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={handleOpen}>
        <FileText className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Statement of Account</DialogTitle>
          </DialogHeader>
          {data && (
            <>
              <iframe
                ref={frameRef}
                title="Statement of Account"
                srcDoc={generateSOAHTML(data)}
                className="h-[62vh] w-full rounded-xl border border-line bg-white"
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF
                </Button>
                <Button onClick={handleDownload} disabled={downloading}>
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}