import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileX,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { ScrollableTable } from "@/components/ScrollableTable";
import { useBranch } from "@/hooks/use-branch";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const STATUS_LABELS: Record<string, string> = {
  filed: "Filed",
  under_review: "Under Review",
  documents_incomplete: "Docs Incomplete",
  documents_complete: "Docs Complete",
  approved: "Approved",
  rejected: "Rejected",
  payout_pending: "Payout Pending",
  payout_completed: "Payout Completed",
};

const STATUS_STYLES: Record<string, string> = {
  filed: "bg-muted text-muted-foreground border border-border",
  under_review: "bg-blue-50 text-blue-700 border border-blue-200",
  documents_incomplete: "bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/20",
  documents_complete: "bg-terminal-green/10 text-terminal-green border border-terminal-green/20",
  approved: "bg-terminal-green/10 text-terminal-green border border-terminal-green/20",
  rejected: "bg-terminal-red/10 text-terminal-red border border-terminal-red/20",
  payout_pending: "bg-purple-50 text-purple-700 border border-purple-200",
  payout_completed: "bg-terminal-green/10 text-terminal-green border border-terminal-green/20",
};

export default function DeathClaims() {
  const { queryBranchId } = useBranch();
  const claims = useQuery(api.deathClaims.list, { branchId: queryBranchId });
  const clients = useQuery(api.clients.list, { branchId: queryBranchId });
  const contracts = useQuery(api.contracts.list, { branchId: queryBranchId });
  const fileClaim = useMutation(api.deathClaims.fileClaim);
  const updateStatus = useMutation(api.deathClaims.updateStatus);
  const submitDocs = useMutation(api.deathClaims.submitDocuments);

  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [form, setForm] = useState({
    contractId: "",
    clientId: "",
    claimantName: "",
    claimantRelationship: "",
    claimantContact: "",
    claimantAddress: "",
    dateOfDeath: "",
    deathCertificateNo: "",
    causeOfDeath: "",
  });

  const claimDetail = useQuery(
    api.deathClaims.get,
    selectedClaim ? { claimId: selectedClaim as any } : "skip"
  );

  const filtered = claims?.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const handleFile = async () => {
    await fileClaim({
      contractId: form.contractId as any,
      clientId: form.clientId as any,
      claimantName: form.claimantName,
      claimantRelationship: form.claimantRelationship,
      claimantContact: form.claimantContact,
      claimantAddress: form.claimantAddress || undefined,
      dateOfDeath: new Date(form.dateOfDeath).getTime(),
      deathCertificateNo: form.deathCertificateNo || undefined,
      causeOfDeath: form.causeOfDeath || undefined,
    });
    setOpen(false);
  };

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded bg-terminal-red/10 flex items-center justify-center">
            <FileX className="h-4.5 w-4.5 text-terminal-red" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Death Claims</h1>
            <p className="text-xs text-muted-foreground">
              Claim processing and payout workflow
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> File Claim
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-2 sm:mx-0 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">&gt; File Death Claim</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs">Client</Label>
                <select
                  value={form.clientId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    const contract = contracts?.find((c) => c.clientId === cid && c.contractStatus !== "assigned_death_claim");
                    setForm({ ...form, clientId: cid, contractId: contract?._id || "" });
                  }}
                  className="w-full border border-input rounded-md px-3 py-2 text-xs mt-1"
                >
                  <option value="">Select client...</option>
                  {clients?.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Contract</Label>
                <Input
                  value={form.contractId}
                  disabled
                  className="text-xs mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Claimant Name</Label>
                  <Input
                    value={form.claimantName}
                    onChange={(e) => setForm({ ...form, claimantName: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Relationship</Label>
                  <Input
                    value={form.claimantRelationship}
                    onChange={(e) => setForm({ ...form, claimantRelationship: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact</Label>
                  <Input
                    value={form.claimantContact}
                    onChange={(e) => setForm({ ...form, claimantContact: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Date of Death</Label>
                  <Input
                    type="date"
                    value={form.dateOfDeath}
                    onChange={(e) => setForm({ ...form, dateOfDeath: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Death Certificate No.</Label>
                <Input
                  value={form.deathCertificateNo}
                  onChange={(e) => setForm({ ...form, deathCertificateNo: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Cause of Death</Label>
                <Input
                  value={form.causeOfDeath}
                  onChange={(e) => setForm({ ...form, causeOfDeath: e.target.value })}
                  className="text-xs mt-1"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleFile}
                  className="text-xs"
                  disabled={!form.clientId || !form.claimantName}
                >
                  File Claim
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "filed", "under_review", "documents_complete", "approved", "payout_pending", "payout_completed"].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
          </Button>
        ))}
      </div>

      {/* Claims Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollableTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Client</TableHead>
                  <TableHead className="text-xs">Contract</TableHead>
                  <TableHead className="text-xs">Claimant</TableHead>
                  <TableHead className="text-xs">Payout</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Filed</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="text-xs">{c.clientName}</TableCell>
                    <TableCell className="text-xs">{c.contractNumber}</TableCell>
                    <TableCell className="text-xs">{c.claimantName}</TableCell>
                    <TableCell className="text-xs font-bold">{formatPHP(c.payoutAmount)}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_STYLES[c.status] || ""}`}>
                        {STATUS_LABELS[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setSelectedClaim(c._id)}
                        >
                          View
                        </Button>
                        {c.status === "filed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 h-7 text-xs"
                            onClick={() => updateStatus({ claimId: c._id, status: "under_review" })}
                          >
                            Review
                          </Button>
                        )}
                        {c.status === "documents_complete" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-terminal-green h-7 text-xs"
                            onClick={() => updateStatus({ claimId: c._id, status: "approved" })}
                          >
                            Approve
                          </Button>
                        )}
                        {c.status === "approved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-purple-600 h-7 text-xs"
                            onClick={() => updateStatus({ claimId: c._id, status: "payout_pending" })}
                          >
                            Payout
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      No death claims found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTable>
        </CardContent>
      </Card>

      {/* Claim Detail Dialog */}
      {claimDetail && (
        <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
          <DialogContent className="mx-2 sm:mx-0 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">
                &gt; Death Claim — {claimDetail.contract?.contractNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Client</p>
                  <p className="text-sm">{claimDetail.client ? `${claimDetail.client.firstName} ${claimDetail.client.lastName}` : "Unknown"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Claimant</p>
                  <p className="text-sm">{claimDetail.claimantName} ({claimDetail.claimantRelationship})</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Date of Death</p>
                  <p className="text-sm">{new Date(claimDetail.dateOfDeath).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Payout Amount</p>
                  <p className="text-sm font-bold text-terminal-green">{formatPHP(claimDetail.payoutAmount)}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground mb-2">Document Checklist</p>
                <div className="space-y-1">
                  {claimDetail.documentsRequired.map((doc) => {
                    const submitted = claimDetail.documentsSubmitted.includes(doc);
                    return (
                      <div key={doc} className="flex items-center gap-2 text-xs">
                        {submitted ? (
                          <CheckCircle className="h-3.5 w-3.5 text-terminal-green" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className={submitted ? "line-through text-muted-foreground" : ""}>{doc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {claimDetail.notes && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Notes</p>
                  <p className="text-xs bg-muted/50 rounded p-2">{claimDetail.notes}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
