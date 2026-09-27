import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
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
  toDataURL,
  type PreparedSOAPDF,
} from "@/lib/generateSOA";
import {
  generateSOAHTML,
  splitAddressEmail,
  type SOAData,
  type SOABeneficiary,
} from "@/components/SOADocument";
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
 * Address and email, on their own lines. Staff sometimes type the email into
 * the address field, so the two are split apart before printing.
 */
function addressFields(client: Doc<"clients">): Pick<SOAData, "clientAddress" | "clientEmail"> {
  const contact = splitAddressEmail(
    [client.address, client.city, client.province].filter(Boolean).join(", "),
    client.email
  );
  return {
    clientAddress: contact.address,
    clientEmail: contact.email || undefined,
  };
}

/**
 * Build SOA data for a SINGLE contract (per-plan SOA).
 */
/** The statement is a fixed-width document; this is its printed width. */
const SOA_DOC_WIDTH = 774;

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
    ...addressFields(client),
    clientContact: client.contactNumber || "\u2014",
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
    ...addressFields(client),
    clientContact: client.contactNumber || "\u2014",
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
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState({ scale: 1, height: 0 });

  // Public branch directory — this component runs for planholder accounts,
  // which cannot call the staff-only `branches.list`.
  const branches = useQuery(api.branches.publicList);
  const settings = useQuery(api.settings.get);

  /**
   * Inline the seal before it reaches the preview.
   *
   * The iframe is rendered from `srcDoc`, which has an opaque origin — a remote
   * logo URL is refused there and renders as a broken-image box, while the PDF
   * (which embeds a data URL) comes out fine. Resolving it once here keeps the
   * preview and the download identical.
   */
  const logoUrl = settings?.logoUrl;
  useEffect(() => {
    if (!logoUrl) return;
    let cancelled = false;
    toDataURL(logoUrl)
      .then((dataUrl) => {
        if (!cancelled && dataUrl) setLogoDataUrl(dataUrl);
      })
      .catch(() => {
        /* keep the raw URL — the header simply drops the seal */
      });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  /**
   * Scale the preview to fit, instead of letting it reflow.
   *
   * The statement is a fixed 774px-wide document — the same one that prints
   * and downloads. Letting the frame size itself meant a narrow dialog
   * squeezed all ten payment columns into a few hundred pixels, breaking every
   * header mid-word. Instead the frame stays at the document's real width and
   * is scaled down to the dialog, so the preview is always a true, if smaller,
   * picture of the PDF. Never scaled above 1:1.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const el = previewRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width > 0 && height > 0) {
        setPreview({ scale: Math.min(1, width / SOA_DOC_WIDTH), height });
      }
    };
    // Measure before first paint: a plain effect runs after the browser has
    // already shown the frame at scale 1, so on slow frames the user would
    // see a cropped pass before the shrink lands.
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const group = records[0];
  const branchName =
    group?.client.branchId
      ? branches?.find((b) => b._id === group.client.branchId)?.name
      : undefined;

  // Prefer the inlined seal; fall back to the stored URL while it resolves.
  const resolvedLogoUrl = logoDataUrl ?? logoUrl;

  let data: SOAData | null = null;
  if (group) {
    if (contractId) {
      const cd = group.contracts.find((c) => c.contract._id === contractId);
      if (cd) {
        data = buildSingleContractSOA(
          group,
          cd,
          branchName,
          resolvedLogoUrl ?? undefined
        );
      }
    } else {
      data = buildSOAData(records, branchName, resolvedLogoUrl ?? undefined);
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
        <DialogContent
          className="sm:max-w-none [grid-template-columns:minmax(0,1fr)]"
          // 774px statement + 2×24px dialog padding = 822px: the dialog hugs
          // the document at 1:1 on desktop, and 94vw keeps it on-screen below
          // that, where the box's scale-to-fit shrinks the frame instead.
          style={{ width: "min(94vw, 822px)" }}
        >
          <DialogHeader>
            <DialogTitle>Statement of Account</DialogTitle>
          </DialogHeader>
          {data && (
            <>
              <div
                ref={previewRef}
                className="h-[62vh] w-full min-w-0 overflow-hidden rounded-xl border border-line bg-white"
              >
                <iframe
                  ref={frameRef}
                  title="Statement of Account"
                  srcDoc={generateSOAHTML(data)}
                  className="h-full w-[774px] max-w-none border-0"
                  style={{
                    // The frame is taller than the box by 1/scale, so the whole
                    // document width fits once scaled while the visible area
                    // still shows a full screenful of the statement.
                    height: preview.height
                      ? preview.height / preview.scale
                      : undefined,
                    transform: `scale(${preview.scale})`,
                    transformOrigin: "top left",
                  }}
                />
              </div>
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
