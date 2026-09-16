import { useEffect, useRef, useState, type ComponentProps } from "react";
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
import {
  deliverPDF,
  generateSOAPDFBlob,
  type PreparedSOAPDF,
} from "@/lib/generateSOA";
import { generateSOAHTML, type SOAData, type SOABeneficiary } from "@/components/SOADocument";
import type { Doc } from "@/convex/_generated/dataModel";

export type PortalContractDetail = {
  contract: Doc<"contracts">;
  payments: Doc<"payments">[];
  schedules: Doc<"payment_schedules">[];
  receipts: Doc<"receipts">[];
  salesAgentName: string | null;
};

export type PortalRecordGroup = {
  client: Doc<"clients">;
  contracts: PortalContractDetail[];
};

/** Compute age in years from a timestamp. */
function computeAge(dob: number): number {
  const now = new Date();
  const birth = new Date(dob);
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

/** Get beneficiaries array from client, falling back to single beneficiary. */
function getBeneficiaries(client: Doc<"clients">): SOABeneficiary[] {
  if (client.beneficiaries && client.beneficiaries.length > 0) {
    return client.beneficiaries;
  }
  return [
    {
      name: client.beneficiaryName || "\u2014",
      relationship: client.beneficiaryRelationship || "\u2014",
    },
  ];
}

/**
 * Build SOA data for a SINGLE contract (per-plan SOA).
 */
export function buildSingleContractSOA(
  group: PortalRecordGroup,
  contractDetail: PortalContractDetail,
  branchName?: string,
  logoUrl?: string
): SOAData | null {
  const client = group.client;
  const fullName = `${client.lastName}, ${client.firstName}${client.middleName ? ` ${client.middleName}` : ""}`;

  const contract = contractDetail.contract;
  const contractPayments = contractDetail.payments.map((p) => ({
    paymentDate: p.paymentDate,
    amount: p.amount,
    paymentChannel: p.paymentChannel,
    orNumber: p.orNumber ?? undefined,
    contractNumber: contract.contractNumber,
    remarks: p.remarks ?? undefined,
  }));

  return {
    clientName: fullName,
    clientAddress:
      [client.address, client.city, client.province].filter(Boolean).join(", ") || "\u2014",
    clientContact: client.contactNumber || "\u2014",
    clientEmail: client.email || undefined,
    clientAge: client.dateOfBirth ? computeAge(client.dateOfBirth) : undefined,
    clientBirthDate: client.dateOfBirth
      ? new Date(client.dateOfBirth).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : undefined,
    beneficiaries: getBeneficiaries(client),
    branchName,
    salesAgent: contractDetail.salesAgentName ?? undefined,
    logoUrl,
    contracts: [
      {
        contractNumber: contract.contractNumber,
        planType: contract.planType,
        planAmount: contract.planAmount,
        monthlyAmortization: contract.monthlyAmortization,
        totalPaid: contract.totalPaid,
        contractStatus: contract.contractStatus,
        startDate: contract.startDate,
      },
    ],
    payments: contractPayments,
    generatedDate: new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    accountNumber: client._id,
  };
}

/**
 * Build SOA data from portal overview records (all linked planholders).
 * Used by the staff-side ClientDetail SOA button.
 */
export function buildSOAData(
  records: PortalRecordGroup[],
  branchName?: string,
  logoUrl?: string
): SOAData | null {
  if (records.length === 0) return null;
  const client = records[0].client;
  const fullName = `${client.lastName}, ${client.firstName}${client.middleName ? ` ${client.middleName}` : ""}`;

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
      [client.address, client.city, client.province].filter(Boolean).join(", ") || "\u2014",
    clientContact: client.contactNumber || "\u2014",
    clientEmail: client.email || undefined,
    clientAge: client.dateOfBirth ? computeAge(client.dateOfBirth) : undefined,
    clientBirthDate: client.dateOfBirth
      ? new Date(client.dateOfBirth).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : undefined,
    beneficiaries: getBeneficiaries(client),
    branchName,
    salesAgent: records[0].contracts[0]?.salesAgentName ?? undefined,
    logoUrl,
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
 * Self-service Statement of Account for the client portal.
 * Per-contract: generates SOA for ONE selected plan.
 */
export function SOAButton({
  records,
  contractId,
  label = "Statement of Account",
  variant = "outline",
  size = "default",
  className,
}: {
  records: PortalRecordGroup[];
  contractId?: string;
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<PreparedSOAPDF | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const branches = useQuery(api.branches.list);
  const settings = useQuery(api.settings.get);

  const group = records[0];
  const branchName =
    group?.client.branchId
      ? branches?.find((b) => b._id === group.client.branchId)?.name
      : undefined;

  let data: SOAData | null = null;
  if (group) {
    if (contractId) {
      const cd = group.contracts.find((c) => c.contract._id === contractId);
      if (cd) {
        data = buildSingleContractSOA(group, cd, branchName, settings?.logoUrl ?? undefined);
      }
    } else {
      data = buildSOAData(records, branchName, settings?.logoUrl ?? undefined);
    }
  }

  // `data` is rebuilt on every render, so it can't be an effect dependency.
  // Its serialized form is compared by value instead, which only changes when
  // the statement's actual contents change.
  const dataKey = data ? JSON.stringify(data) : "";

  /**
   * Build the PDF as soon as the dialog opens, not when the button is clicked.
   *
   * Rendering off-screen, waiting on webfonts and rasterizing the whole page
   * takes seconds. Doing that inside the click handler means the browser's
   * transient user activation has long expired by the time we call
   * `deliverPDF`, and browsers drop downloads/popups that arrive late. Warming
   * it here lets the click deliver a ready blob immediately.
   */
  useEffect(() => {
    if (!open || !dataKey) return;
    let cancelled = false;
    setPrepared(null);
    setPdfError(null);
    setPreparing(true);

    generateSOAPDFBlob(JSON.parse(dataKey) as SOAData)
      .then((result) => {
        if (!cancelled) setPrepared(result);
      })
      .catch((err: unknown) => {
        console.error("Failed to generate SOA PDF:", err);
        if (!cancelled) {
          setPdfError(
            err instanceof Error ? err.message : "The PDF could not be generated."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, dataKey]);

  const handleOpen = () => {
    if (!data) {
      toast.error("No linked plan records yet", {
        description:
          "Once your plan is linked to this account your statement will appear here.",
      });
      return;
    }
    setOpen(true);
  };

  // Deliberately synchronous: the blob is already built, so the browser still
  // treats this as a direct result of the user's click.
  const handleDownload = () => {
    if (!prepared) return;
    try {
      const mode = deliverPDF(prepared);
      if (mode === "tab") {
        toast.success("Statement opened in a new tab", {
          description: "Use the download icon in the PDF viewer to save a copy.",
        });
      } else if (mode === "blocked") {
        toast.error("Couldn't open the PDF in a new tab", {
          description: "Use Print / Save as PDF instead — that always works.",
        });
      } else {
        toast.success("Statement of Account downloaded");
      }
    } catch (err) {
      console.error("Failed to deliver SOA PDF:", err);
      toast.error("Could not open the PDF", {
        description: "Use Print / Save as PDF instead.",
      });
    }
  };

  const handlePrint = () => {
    const frame = frameRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  };

  const preparingLabel = preparing || !prepared;

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
              {pdfError && (
                <p className="text-xs text-muted-foreground">
                  {pdfError} Use <strong>Print / Save as PDF</strong> instead.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={preparingLabel || !prepared}
                  title={
                    !prepared && !preparing
                      ? "The PDF could not be generated — use Print instead"
                      : undefined
                  }
                >
                  {preparingLabel ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {preparingLabel ? "Preparing PDF…" : "Download PDF"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
