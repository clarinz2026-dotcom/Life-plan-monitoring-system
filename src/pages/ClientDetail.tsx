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
  Plus,
  Download,
  Pencil,
  Save,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_COLORS: Record<string, string> = {
  current: "terminal-status-current",
  delinquent_30: "terminal-status-delinquent",
  delinquent_60: "terminal-status-delinquent",
  delinquent_90: "terminal-status-claim",
  lapsed: "terminal-status-claim",
  fully_paid: "terminal-status-paid",
  assigned_death_claim: "terminal-status-claim",
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

import { generateSOAPDF } from "@/lib/generateSOA";

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [downloadingSOA, setDownloadingSOA] = useState(false);
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

  const handleDownloadSOA = useCallback(async () => {
    if (!client) return;
    setDownloadingSOA(true);
    try {
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

      await generateSOAPDF({
        clientName,
        clientAddress:
          [client.address, client.city, client.province].filter(Boolean).join(", ") || "—",
        clientContact: client.contactNumber || "—",
        clientEmail: client.email || undefined,
        clientAge: undefined,
        beneficiaries: [{ name: client.beneficiaryName || "—", relationship: client.beneficiaryRelationship || "—" }],
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
      });
      toast.success("Statement of Account downloaded");
    } catch (error) {
      console.error("Failed to generate SOA PDF:", error);
      toast.error("Could not generate the SOA PDF", {
        description:
          error instanceof Error
            ? error.message
            : "Please try again — if it still fails, the client can download it from the portal instead.",
      });
    } finally {
      setDownloadingSOA(false);
    }
  }, [client, contracts, payments, clientId, branch?.name, settings?.logoUrl]);

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
          <p className="text-xs text-muted-foreground">
            {[client.contactNumber, [client.city, client.province].filter(Boolean).join(", ")]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {client.notes && (
            <p className="text-[10px] text-muted-foreground/80 break-words">
              {client.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
            disabled={downloadingSOA}
          >
            <Download className="h-4 w-4" />
            {downloadingSOA ? "Generating..." : "SOA"}
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
                      {contract.contractStatus.replace(/_/g, " ")}
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
    </div>
  );
}
