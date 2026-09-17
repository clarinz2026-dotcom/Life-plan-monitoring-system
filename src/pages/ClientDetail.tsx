import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  FileText,
  CreditCard,
  FileUp,
  Plus,
  Download,
  Pencil,
  Save,
  Loader2,
  ArrowRightLeft,
  Building2,
  Archive,
  Upload,
} from "lucide-react";
import { parsePaymentUpload, parseUploadDate } from "@/lib/parsePaymentUpload";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranch } from "@/hooks/use-branch";

const STATUS_COLORS: Record<string, string> = {
  current: "terminal-status-current",
  reinstated: "terminal-status-current",
  delinquent_30: "terminal-status-delinquent",
  delinquent_60: "terminal-status-delinquent",
  delinquent_90: "terminal-status-claim",
  lapsed: "terminal-status-claim",
  fully_paid: "terminal-status-paid",
};

/**
 * The three payment statuses the office works with. The stored status still
 * records how far behind a plan is, which the aging report reads.
 */
const STATUS_LABELS: Record<string, string> = {
  current: "Current",
  delinquent_30: "30 Days Late",
  delinquent_60: "60 Days Late",
  delinquent_90: "90 Days Late",
  lapsed: "Lapsed",
  fully_paid: "Fully Paid",
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Convert a timestamp to a yyyy-mm-dd string for <input type="date"> (local time). */
function tsToDateInput(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

import {
  deliverPDF,
  generateSOAPDFBlob,
  type PreparedSOAPDF,
} from "@/lib/generateSOA";
import type { SOAData } from "@/components/SOADocument";

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [downloadingSOA, setDownloadingSOA] = useState(false);
  const [preparedSOA, setPreparedSOA] = useState<PreparedSOAPDF | null>(null);
  const [soaError, setSoaError] = useState<string | null>(null);
  const client = useQuery(
    api.clients.get,
    clientId ? { clientId: clientId as any } : "skip"
  );
  const contracts = useQuery(
    api.contracts.list,
    clientId ? { clientId: clientId as any } : {}
  );
  const payments = useQuery(
    api.payments.list,
    clientId ? { clientId: clientId as any } : {}
  );
  const branch = useQuery(
    api.branches.get,
    client?.branchId ? { branchId: client.branchId } : "skip"
  );
  const settings = useQuery(api.settings.get);

  // Branch transfer (Head Office only). The branch list is staff-only, so it is
  // skipped for accounts that cannot transfer.
  const { isCeoOrAdmin } = useBranch();
  const allBranches = useQuery(api.branches.list, isCeoOrAdmin ? {} : "skip");
  const transferHistory = useQuery(api.branches.transferHistory, {
    clientId: clientId as any,
  });
  const transferClient = useMutation(api.branches.transferClient);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferForm, setTransferForm] = useState({
    toBranchId: "",
    reason: "",
  });

  const updateClient = useMutation(api.clients.update);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    firstName: string;
    middleName: string;
    lastName: string;
    gender: "male" | "female" | "other";
    dateOfBirth: string;
    address: string;
  }>({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "male",
    dateOfBirth: "",
    address: "",
  });

  const createContract = useMutation(api.contracts.create);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractForm, setContractForm] = useState({
    contractNumber: "",
    planType: "",
    planAmount: "",
    monthlyAmortization: "",
    startDate: "",
  });

  const fullName = client?.middleName
    ? `${client.lastName}, ${client.firstName} ${client.middleName}`
    : client ? `${client.lastName}, ${client.firstName}` : "";

  const clientContracts = contracts || [];
  const clientPayments = payments || [];

  // ── Add payment dialog ───────────────────────────────────────────────
  const recordPayment = useMutation(api.payments.record);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    contractId: "",
    amount: "",
    paymentChannel: "cash" as
      | "cash"
      | "gcash"
      | "maya"
      | "bank_transfer"
      | "check",
    paymentDate: new Date().toISOString().split("T")[0],
    orNumber: "",
    referenceNumber: "",
    chequeNumber: "",
    bankName: "",
    remarks: "",
  });

  // ── Bulk upload payments ──────────────────────────────────────────────
  const [uploadPaymentOpen, setUploadPaymentOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<
    { contractNumber: string; amount: number; channel: string; date: string; orNumber: string; remarks: string; fromStatement: boolean }[]
  >([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWorking, setUploadWorking] = useState(false);
  const bulkRecordPayments = useMutation(api.payments.bulkRecord);

  const activeContracts = clientContracts.filter((c) => c.contractStatus !== "fully_paid");

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await recordPayment({
        contractId: paymentForm.contractId as any,
        amount: Number(paymentForm.amount),
        paymentChannel: paymentForm.paymentChannel,
        paymentDate: paymentForm.paymentDate
          ? new Date(paymentForm.paymentDate).getTime()
          : Date.now(),
        orNumber: paymentForm.orNumber || undefined,
        referenceNumber: paymentForm.referenceNumber || undefined,
        chequeNumber: paymentForm.chequeNumber || undefined,
        bankName: paymentForm.bankName || undefined,
        remarks: paymentForm.remarks || undefined,
      });
      toast.success(`Payment recorded! Receipt: ${result.receiptNumber}`);
      setAddPaymentOpen(false);
      setPaymentForm({
        contractId: paymentForm.contractId,
        amount: "",
        paymentChannel: "cash",
        paymentDate: new Date().toISOString().split("T")[0],
        orNumber: "",
        referenceNumber: "",
        chequeNumber: "",
        bankName: "",
        remarks: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploadFile(file);
    setUploadError(null);
    setUploadPreview([]);
    try {
      const { rows, warnings } = await parsePaymentUpload(file);
      if (rows.length === 0) {
        setUploadError(warnings.join("\n") || "No payment rows could be read from the file.");
        return;
      }
      setUploadPreview(rows.map((row) => ({
        contractNumber: row.contractNumber,
        amount: row.amount,
        channel: row.channel,
        date: parseUploadDate(row.date) || row.date,
        orNumber: row.orNumber,
        remarks: row.remarks,
        fromStatement: row.fromStatement,
      })));
      if (warnings.length > 0) setUploadError(warnings.join("\n"));
    } catch (err: any) {
      setUploadError(`Failed to parse file: ${err?.message || "unknown error"}`);
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (uploadPreview.length === 0 || !contracts) return;
    setUploadWorking(true);
    setUploadError(null);
    try {
      const contractMap = new Map<string, string>();
      for (const c of contracts) contractMap.set(c.contractNumber.toLowerCase(), String(c._id));
      const entries: { contractId: string; amount: number; channel: string; date: string; orNumber: string; remarks: string }[] = [];
      const errors: string[] = [];
      for (let i = 0; i < uploadPreview.length; i++) {
        const row = uploadPreview[i];
        const contractId = contractMap.get(row.contractNumber.toLowerCase());
        if (!contractId) { errors.push(`Row ${i + 1}: contract "${row.contractNumber}" not found`); continue; }
        if (!row.amount || row.amount <= 0) { errors.push(`Row ${i + 1}: invalid amount`); continue; }
        entries.push({ ...row, contractId });
      }
      if (errors.length > 0 && entries.length === 0) { setUploadError(errors.join("\n")); setUploadWorking(false); return; }
      const result = await bulkRecordPayments({
        payments: entries.map((p) => ({
          contractId: p.contractId as any,
          amount: p.amount,
          paymentChannel: (p.channel as any) || "cash",
          paymentDate: p.date ? new Date(p.date).getTime() : Date.now(),
          orNumber: p.orNumber || undefined,
          remarks: p.remarks || undefined,
        })),
      });
      if (result.recorded > 0) toast.success(`Recorded ${result.recorded} payment(s) with ${result.receipts} receipt(s)`);
      if (result.errors.length > 0) setUploadError(result.errors.join("\n"));
      if (result.recorded > 0) setUploadPaymentOpen(false);
      setUploadFile(null);
      setUploadPreview([]);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploadWorking(false);
    }
  };

  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    await createContract({
      clientId: clientId as any,
      contractNumber: contractForm.contractNumber,
      planType: contractForm.planType,
      planAmount: Number(contractForm.planAmount),
      monthlyAmortization: Number(contractForm.monthlyAmortization),
      startDate: contractForm.startDate
        ? new Date(contractForm.startDate).getTime()
        : Date.now(),
    });
    setContractDialogOpen(false);
    setContractForm({
      contractNumber: "",
      planType: "",
      planAmount: "",
      monthlyAmortization: "",
      startDate: "",
    });
  };

  /**
   * Build the staff-side statement for this planholder.
   *
   * A plain function rather than a callback: the PDF is generated in an effect
   * keyed on its serialized contents, so holding a stable identity would only
   * hide genuine changes.
   */
  const buildClientSOA = (): SOAData | null => {
    if (!client) return null;
    {
      const clientName = client.middleName
        ? `${client.lastName}, ${client.firstName} ${client.middleName}`
        : `${client.lastName}, ${client.firstName}`;

      const soaContracts = (contracts || []).map((c) => ({
        contractNumber: c.contractNumber,
        planType: c.planType,
        planAmount: c.planAmount,
        monthlyAmortization: c.monthlyAmortization,
        totalPaid: c.totalPaid,
        contractStatus: c.contractStatus,
        startDate: c.startDate,
      }));

      const soaPayments = (payments || []).map((p) => ({
        paymentDate: p.paymentDate,
        amount: p.amount,
        paymentChannel: p.paymentChannel,
        orNumber: p.orNumber,
        contractNumber: p.contract?.contractNumber || "—",
        remarks: p.remarks,
      }));

      // Age shown on the printed form, derived from the birth date.
      const birthDate = client.dateOfBirth ? new Date(client.dateOfBirth) : null;
      let clientAge: number | undefined;
      if (birthDate) {
        const today = new Date();
        clientAge = today.getFullYear() - birthDate.getFullYear();
        const monthDelta = today.getMonth() - birthDate.getMonth();
        if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
          clientAge--;
        }
      }

      return {
        clientName,
        clientAddress:
          [client.address, client.city, client.province].filter(Boolean).join(", ") || "—",
        clientContact: client.contactNumber || "—",
        clientEmail: client.email || undefined,
        clientAge,
        beneficiaries:
          client.beneficiaries && client.beneficiaries.length > 0
            ? client.beneficiaries
            : [
                {
                  name: client.beneficiaryName || "—",
                  relationship: client.beneficiaryRelationship || "—",
                },
              ],
        branchName: branch?.name,
        clientBirthDate: client.dateOfBirth
          ? new Date(client.dateOfBirth).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : undefined,
        logoUrl: settings?.logoUrl ?? undefined,
        contracts: soaContracts,
        payments: soaPayments,
        generatedDate: new Date().toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        accountNumber: clientId || "—",
      };
    }
  };

  // Serialized contents, so the effect below re-runs only when the statement
  // itself changes — not on every render of this page.
  const soaData = buildClientSOA();
  const soaDataKey = soaData ? JSON.stringify(soaData) : "";

  /**
   * Pre-build the PDF as soon as this planholder's data has loaded.
   *
   * Generation renders off-screen, waits on webfonts and rasterizes the whole
   * page — seconds, far longer than a browser keeps a click's transient user
   * activation alive. Building it up-front lets the SOA button hand over a
   * finished blob synchronously, which is what makes the download land; a
   * sandboxed preview frame silently drops downloads that arrive late.
   */
  useEffect(() => {
    if (!soaDataKey) return;
    let cancelled = false;
    setPreparedSOA(null);
    setSoaError(null);
    setDownloadingSOA(true);

    generateSOAPDFBlob(JSON.parse(soaDataKey) as SOAData)
      .then((result) => {
        if (!cancelled) setPreparedSOA(result);
      })
      .catch((error: unknown) => {
        console.error("Failed to generate SOA PDF:", error);
        if (!cancelled) {
          setSoaError(
            error instanceof Error ? error.message : "The PDF could not be generated."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDownloadingSOA(false);
      });

    return () => {
      cancelled = true;
    };
  }, [soaDataKey]);

  // Deliberately synchronous: the blob is already built, so the browser still
  // treats this as a direct result of the user's click.
  const handleDownloadSOA = () => {
    if (!preparedSOA) return;
    try {
      const mode = deliverPDF(preparedSOA);
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
    } catch (error) {
      console.error("Failed to open SOA PDF:", error);
      toast.error("Could not open the PDF", {
        description: soaError ?? "Please try again.",
      });
    }
  };

  const openEditDialog = useCallback(() => {
    if (!client) return;
    setEditForm({
      firstName: client.firstName,
      middleName: client.middleName || "",
      lastName: client.lastName,
      gender: client.gender,
      dateOfBirth: tsToDateInput(client.dateOfBirth),
      address: client.address || "",
    });
    setEditDialogOpen(true);
  }, [client]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !client) return;
    setSavingEdit(true);
    try {
      await updateClient({
        clientId: clientId as any,
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName.trim() || undefined,
        lastName: editForm.lastName.trim(),
        gender: editForm.gender,
        dateOfBirth: editForm.dateOfBirth
          ? new Date(editForm.dateOfBirth).getTime()
          : client.dateOfBirth,
        address: editForm.address.trim(),
      });
      toast.success("Client updated successfully");
      setEditDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update client");
    } finally {
      setSavingEdit(false);
    }
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading client...</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/clients")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{fullName}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              {[client.contactNumber, [client.city, client.province].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
            {/* Which branch owns this planholder is the first thing to know
                when a record looks missing from a filtered list. */}
            <span className="inline-flex items-center gap-1 rounded-full bg-evergreen/8 px-2 py-0.5 text-[11px] font-medium text-evergreen ring-1 ring-evergreen/15">
              <Building2 className="h-3 w-3" />
              {branch ? `${branch.name} (${branch.code})` : "No branch assigned"}
            </span>
            {client.archivedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-terminal-amber/12 px-2 py-0.5 text-[11px] font-medium text-terminal-amber ring-1 ring-terminal-amber/25">
                <Archive className="h-3 w-3" />
                Archived
              </span>
            )}
          </p>
          {client.notes && (
            <p className="text-[10px] text-muted-foreground/80 break-words">
              {client.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCeoOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setTransferForm({ toBranchId: "", reason: "" });
                setTransferOpen(true);
              }}
              title="Move this planholder to another branch"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={openEditDialog}
          >
            <Pencil className="h-4 w-4" />
            Edit Client
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleDownloadSOA}
            disabled={downloadingSOA || !preparedSOA}
            title={soaError ?? undefined}
          >
            <Download className="h-4 w-4" />
            {downloadingSOA ? "Preparing..." : "SOA"}
          </Button>
        </div>
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="">
              <span className="text-terminal-green">$</span> Edit Client
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Update personal details for {fullName || "this client"}
            </p>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">First Name *</Label>
                <Input
                  value={editForm.firstName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, firstName: e.target.value })
                  }
                  className="text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Middle Name</Label>
                <Input
                  value={editForm.middleName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, middleName: e.target.value })
                  }
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Last Name *</Label>
                <Input
                  value={editForm.lastName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lastName: e.target.value })
                  }
                  className="text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date of Birth *</Label>
                <Input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) =>
                    setEditForm({ ...editForm, dateOfBirth: e.target.value })
                  }
                  className="text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Gender *</Label>
                <select
                  value={editForm.gender}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      gender: e.target.value as typeof editForm.gender,
                    })
                  }
                  className="text-sm bg-background border border-border rounded-md h-9 px-2 w-full"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
                className="text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={savingEdit || !editForm.firstName.trim() || !editForm.lastName.trim()}
              className="w-full gap-2"
            >
              {savingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Client info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Personal */}
        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Full Name</span>
              <span className="font-medium">{fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date of Birth</span>
              <span className="text-xs">
                {format(new Date(client.dateOfBirth), "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gender</span>
              <span className="capitalize">{client.gender}</span>
            </div>
            {client.occupation && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Occupation</span>
                <span>{client.occupation}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="text-xs">{client.contactNumber || "—"}</span>
            </div>
            {client.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="text-xs">{client.email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <span className="text-xs text-right max-w-[200px]">
                {client.address || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">City / Province</span>
              <span className="text-xs">
                {client.city}, {client.province}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Beneficiary */}
        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              Beneficiary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{client.beneficiaryName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Relationship</span>
              <span>{client.beneficiaryRelationship}</span>
            </div>
            {client.beneficiaryContact && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact</span>
                <span className="text-xs">
                  {client.beneficiaryContact}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contracts section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Contracts ({clientContracts.length})
        </h2>
        <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="">
                <span className="text-terminal-green">$</span> New Contract
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleContractSubmit} className="space-y-3 mt-2">
              <div>
                <Label className="text-xs">Contract Number *</Label>
                <Input
                  value={contractForm.contractNumber}
                  onChange={(e) =>
                    setContractForm({ ...contractForm, contractNumber: e.target.value })
                  }
                  placeholder="e.g. CTR-2024-0001"
                  className="text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Plan Type *</Label>
                <Input
                  value={contractForm.planType}
                  onChange={(e) =>
                    setContractForm({ ...contractForm, planType: e.target.value })
                  }
                  placeholder="e.g. Memorial Plan A"
                  className="text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Total Plan Amount (₱) *</Label>
                  <Input
                    type="number"
                    value={contractForm.planAmount}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, planAmount: e.target.value })
                    }
                    className="text-sm"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Monthly (₱) *</Label>
                  <Input
                    type="number"
                    value={contractForm.monthlyAmortization}
                    onChange={(e) =>
                      setContractForm({
                        ...contractForm,
                        monthlyAmortization: e.target.value,
                      })
                    }
                    className="text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Start Date *</Label>
                <Input
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) =>
                    setContractForm({ ...contractForm, startDate: e.target.value })
                  }
                  className="text-sm"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Create Contract
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clientContracts.length === 0 ? (
        <Card className="border-border/60 shadow-none">
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No contracts yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clientContracts.map((contract) => {
            const progress = contract.planAmount
              ? Math.min((contract.totalPaid / contract.planAmount) * 100, 100)
              : 0;
            return (
              <Card key={contract._id} className="border-border/60 shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {contract.contractNumber}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        STATUS_COLORS[contract.contractStatus] || ""
                      }`}
                    >
                      {STATUS_LABELS[contract.contractStatus] ||
                        contract.contractStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Plan
                      </p>
                      <p className="font-medium">{contract.planType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Monthly
                      </p>
                      <p className="text-sm">
                        {formatPHP(contract.monthlyAmortization)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Total
                      </p>
                      <p className="text-sm">
                        {formatPHP(contract.planAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Paid
                      </p>
                      <p className="text-sm text-terminal-green font-bold">
                        {formatPHP(contract.totalPaid)}
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-terminal-green rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">
                      {progress.toFixed(0)}%
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Started:{" "}
                    {format(new Date(contract.startDate), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payments section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          Payment History ({clientPayments.length})
        </h2>
        <div className="flex gap-2">
          <Dialog open={addPaymentOpen} onOpenChange={setAddPaymentOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Record Payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handlePaymentSubmit} className="space-y-4 mt-3">
                <div>
                  <Label className="text-[14px]">Contract *</Label>
                  <select
                    value={paymentForm.contractId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, contractId: e.target.value })}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                    required
                  >
                    <option value="">Select contract…</option>
                    {activeContracts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.contractNumber} — {c.planType} ({formatPHP(c.planAmount)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[14px]">Amount (₱) *</Label>
                    <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="h-11 text-base" required />
                  </div>
                  <div>
                    <Label className="text-[14px]">Channel *</Label>
                    <select
                      value={paymentForm.paymentChannel}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentChannel: e.target.value as typeof paymentForm.paymentChannel })}
                      className="h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                    >
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="maya">Maya</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-[14px]">Payment Date *</Label>
                  <Input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="h-11 text-base" required />
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Reference Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentForm.paymentChannel === "check" && (
                      <>
                        <div><Label className="text-[14px]">Cheque Number</Label><Input value={paymentForm.chequeNumber} onChange={(e) => setPaymentForm({ ...paymentForm, chequeNumber: e.target.value })} className="h-11 text-base" /></div>
                        <div><Label className="text-[14px]">Bank Name</Label><Input value={paymentForm.bankName} onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })} className="h-11 text-base" /></div>
                      </>
                    )}
                    {(paymentForm.paymentChannel === "gcash" || paymentForm.paymentChannel === "maya" || paymentForm.paymentChannel === "bank_transfer") && (
                      <div className="col-span-2"><Label className="text-[14px]">Reference Number</Label><Input value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} className="h-11 text-base" /></div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-[14px]">Remarks</Label>
                  <Input value={paymentForm.remarks} onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })} placeholder="Optional notes…" className="h-11 text-base" />
                </div>
                <Button type="submit" className="w-full h-12 text-[15px] font-semibold">Record Payment & Issue Receipt</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={uploadPaymentOpen} onOpenChange={setUploadPaymentOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileUp className="h-4 w-4" />
                Upload Payments
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Bulk Upload Payments</DialogTitle>
                <DialogDescription className="text-sm">
                  Upload a CSV or XLSX file. Two formats are accepted: the simple ledger (contractNumber, amount, channel, date, orNumber, remarks) or a statement export (contract header block + Pay Class / O.R. Date / O.R. No. / Amount table).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-3">
                <div>
                  <Label className="text-[14px]">Payment File (CSV or XLSX) *</Label>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }} className="text-sm" />
                </div>
                {uploadFile && <p className="text-xs text-muted-foreground">{uploadFile.name} ({uploadPreview.length} row{uploadPreview.length !== 1 ? "s" : ""} parsed)</p>}
                {uploadError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><p className="text-sm text-destructive whitespace-pre-wrap">{uploadError}</p></div>}
                {uploadPreview.length > 0 && (
                  <div className="max-h-60 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0"><tr><th className="px-3 py-2 text-left">Contract</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Channel</th><th className="px-3 py-2 text-left">Date</th></tr></thead>
                      <tbody>
                        {uploadPreview.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="px-3 py-1.5">{row.contractNumber}</td>
                            <td className="px-3 py-1.5 text-right font-medium">{formatPHP(row.amount)}</td>
                            <td className="px-3 py-1.5">{row.channel}</td>
                            <td className="px-3 py-1.5">{row.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {uploadPreview.length > 20 && <p className="px-3 py-2 text-xs text-muted-foreground">…and {uploadPreview.length - 20} more rows</p>}
                  </div>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => { setUploadPaymentOpen(false); setUploadFile(null); setUploadPreview([]); setUploadError(null); }}>Cancel</Button>
                <Button onClick={handleBulkUploadSubmit} disabled={uploadWorking || uploadPreview.length === 0} className="gap-2">
                  {uploadWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadWorking ? "Uploading…" : `Record ${uploadPreview.length} Payment(s)`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {clientPayments.length === 0 ? (
        <Card className="border-border/60 shadow-none">
          <CardContent className="py-8 text-center">
            <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No payments recorded
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Contract
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Channel
                  </th>
                  <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    OR #
                  </th>
                  <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientPayments.map((p) => (
                  <tr key={p._id} className="border-b border-border/30 last:border-0">
                    <td className="py-2.5 px-4 text-xs">
                      {format(new Date(p.paymentDate), "MMM d, yyyy")}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {p.contract?.contractNumber || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {p.paymentChannel.toUpperCase().replace("_", " ")}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">
                      {p.orNumber || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-terminal-green">
                      {formatPHP(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/*
       * Branch transfer trail. Each move is recorded permanently; a planholder
       * who relocates keeps a readable history and their old payments stay with
       * the branch that actually collected them.
       */}
      {transferHistory && transferHistory.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              Branch transfer history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transferHistory.map((t) => (
              <div
                key={t._id}
                className="rounded-xl border border-line bg-paper px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                  <span className="font-medium text-ink">
                    {t.fromBranchName || "Unassigned"}
                  </span>
                  <ArrowRightLeft className="h-3.5 w-3.5 text-stone" />
                  <span className="font-medium text-evergreen">
                    {t.toBranchName}
                  </span>
                  <span className="ml-auto text-[12px] text-stone">
                    {new Date(t.createdAt).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {t.reason && (
                  <p className="mt-1 text-[12.5px] text-stone">{t.reason}</p>
                )}
                <p className="mt-1 text-[12px] text-stone">
                  {t.movedContracts} contract(s) moved · {t.retainedPayments}{" "}
                  payment(s) kept with the recording branch
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transfer dialog — Head Office only */}
      {isCeoOrAdmin && (
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Transfer {fullName} to another branch
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!transferForm.toBranchId) return;
                setTransferring(true);
                try {
                  const result = await transferClient({
                    clientId: client._id,
                    toBranchId: transferForm.toBranchId as any,
                    reason: transferForm.reason.trim() || undefined,
                  });
                  toast.success(
                    "Transferred. " +
                      result.movedContracts +
                      " contract(s) moved; " +
                      result.retainedPayments +
                      " payment(s) kept with the branch that recorded them."
                  );
                  setTransferOpen(false);
                  setTransferForm({ toBranchId: "", reason: "" });
                } catch (err: any) {
                  toast.error(
                    err?.message || "Could not transfer this planholder."
                  );
                } finally {
                  setTransferring(false);
                }
              }}
              className="space-y-4 mt-3"
            >
              <p className="rounded-xl border border-line bg-cream/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-stone">
                The planholder and their live contracts move to the receiving
                branch. Payments and receipts stay under the branch that
                recorded them, so neither branch&apos;s historical collections,
                reports, or reconciliations change.
              </p>
              <div>
                <Label className="text-[14px]">Receiving branch *</Label>
                <select
                  value={transferForm.toBranchId}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      toBranchId: e.target.value,
                    })
                  }
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                  required
                >
                  <option value="">Select branch…</option>
                  {allBranches
                    ?.filter((b) => b.isActive && b._id !== client.branchId)
                    .map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label className="text-[14px]">Reason (optional)</Label>
                <Input
                  value={transferForm.reason}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      reason: e.target.value,
                    })
                  }
                  placeholder="e.g. planholder relocated"
                  className="h-11 text-base"
                />
              </div>
              <Button
                type="submit"
                disabled={transferring}
                className="w-full h-12 text-[15px] font-semibold"
              >
                {transferring ? "Transferring…" : "Transfer planholder"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
