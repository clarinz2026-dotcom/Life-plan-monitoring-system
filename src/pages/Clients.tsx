import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Users,
  ArrowRight,
  Trash2,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ScrollableTable } from "@/components/ScrollableTable";
import { toast } from "sonner";
import { useBranch } from "@/hooks/use-branch";
import { Archive, ArchiveRestore } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  current: "Current",
  delinquent_30: "30 Days Late",
  delinquent_60: "60 Days Late",
  delinquent_90: "90 Days Late",
  lapsed: "Lapsed",
  fully_paid: "Fully Paid",
  no_contract: "No Contract",
};

const STATUS_COLORS: Record<string, string> = {
  current: "terminal-status-current",
  delinquent_30: "terminal-status-delinquent",
  delinquent_60: "terminal-status-delinquent",
  delinquent_90: "terminal-status-claim",
  lapsed: "terminal-status-claim",
  fully_paid: "terminal-status-paid",
  no_contract: "text-muted-foreground",
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "current", label: "Current" },
  { key: "delinquent_30", label: "30 Days Late" },
  { key: "delinquent_60", label: "60 Days Late" },
  { key: "delinquent_90", label: "90 Days Late" },
  { key: "lapsed", label: "Lapsed" },
  { key: "fully_paid", label: "Fully Paid" },
];

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const PAGE_SIZE = 15;

function getPageItems(
  current: number,
  total: number,
): Array<number | "gap"> {
  const wanted = new Set<number>();
  for (let p = 0; p < total; p++) {
    if (p === 0 || p === total - 1 || Math.abs(p - current) <= 1) wanted.add(p);
  }
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: Array<number | "gap"> = [];
  let prev: number | null = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) items.push("gap");
    items.push(p);
    prev = p;
  }
  return items;
}

export default function Clients() {
  const { queryBranchId, isBranchStaff, isCeoOrAdmin, isManager } = useBranch();
  // Archived planholders are hidden unless explicitly asked for.
  const [showArchived, setShowArchived] = useState(false);
  const clientsWithStatus = useQuery(api.clients.listWithStatus, {
    branchId: queryBranchId,
    includeArchived: showArchived,
  });
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);

  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, showArchived]);

  const bulkDelete = useMutation(api.clients.bulkDelete);
  const archiveClients = useMutation(api.clients.archive);
  const restoreClients = useMutation(api.clients.restore);
  const canArchive = isCeoOrAdmin || isManager;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    gender: "male" as "male" | "female" | "other",
    contactNumber: "",
    email: "",
    address: "",
    city: "",
    province: "",
    zipCode: "",
    occupation: "",
    beneficiaryName: "",
    beneficiaryRelationship: "",
    beneficiaryContact: "",
  });

  const createClient = useMutation(api.clients.create);

  const toggleClient = (clientId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await bulkDelete({
        clientIds: [...selectedIds] as any,
      });
      toast.success(`Deleted ${result.deleted} client${result.deleted !== 1 ? "s" : ""}.`);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not delete the selected clients.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const result = await archiveClients({
        clientIds: [...selectedIds] as any,
        reason: archiveReason.trim() || undefined,
      });
      toast.success(
        `Archived ${result.archived} planholder${result.archived !== 1 ? "s" : ""}. All payment, receipt, and SOA history is intact.`
      );
      setSelectedIds(new Set());
      setArchiveDialogOpen(false);
      setArchiveReason("");
    } catch (error: any) {
      toast.error(error?.message || "Could not archive the selected planholders.");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestore = async () => {
    setIsArchiving(true);
    try {
      const result = await restoreClients({
        clientIds: [...selectedIds] as any,
      });
      toast.success(
        `Restored ${result.restored} planholder${result.restored !== 1 ? "s" : ""}.`
      );
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error?.message || "Could not restore the selected planholders.");
    } finally {
      setIsArchiving(false);
    }
  };

  // Derived from the query result — memoized so typing in the search box or
  // toggling a checkbox only recomputes what actually changed instead of
  // re-filtering the full list on every render.
  const filteredClients = useMemo(() => {
    if (!clientsWithStatus) return undefined;
    const q = search.trim().toLowerCase();
    return clientsWithStatus.filter((item) => {
      if (q) {
        const matchesSearch =
          item.client.lastName.toLowerCase().includes(q) ||
          item.client.firstName.toLowerCase().includes(q) ||
          item.client.contactNumber.includes(q);
        if (!matchesSearch) return false;
      }
      if (statusFilter !== "all" && item.computedStatus !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [clientsWithStatus, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of clientsWithStatus ?? []) {
      counts[item.computedStatus] = (counts[item.computedStatus] || 0) + 1;
    }
    return counts;
  }, [clientsWithStatus]);

  const clientCount = clientsWithStatus?.length || 0;

  const selectedNames = useMemo(
    () =>
      (clientsWithStatus ?? [])
        .filter((item) => selectedIds.has(String(item.client._id)))
        .map((item) => `${item.client.lastName}, ${item.client.firstName}`),
    [clientsWithStatus, selectedIds]
  );

  const totalFiltered = filteredClients?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageClients = filteredClients?.slice(pageStart, pageStart + PAGE_SIZE);
  const pageItems = getPageItems(currentPage, totalPages);

  const pageClientIds = (pageClients ?? []).map((item) => String(item.client._id));
  const allVisibleSelected =
    pageClientIds.length > 0 && pageClientIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = pageClientIds.some((id) => selectedIds.has(id));

  const toggleSelectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        pageClientIds.forEach((id) => next.delete(id));
      } else {
        pageClientIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createClient({
      ...form,
      dateOfBirth: form.dateOfBirth
        ? new Date(form.dateOfBirth).getTime()
        : Date.now(),
      middleName: form.middleName || undefined,
      email: form.email || undefined,
      occupation: form.occupation || undefined,
      beneficiaryContact: form.beneficiaryContact || undefined,
    });
    setDialogOpen(false);
    setForm({
      firstName: "",
      lastName: "",
      middleName: "",
      dateOfBirth: "",
      gender: "male",
      contactNumber: "",
      email: "",
      address: "",
      city: "",
      province: "",
      zipCode: "",
      occupation: "",
      beneficiaryName: "",
      beneficiaryRelationship: "",
      beneficiaryContact: "",
    });
  };

  const inputClass =
    "text-base bg-background border-border h-11 focus-visible:ring-ring";

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Clients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientCount} total client{clientCount !== 1 && "s"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="default" className="gap-2 h-11 px-5 text-[15px]">
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">New Client</span>
              <span className="sm:hidden">New</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Add New Client
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-3">
              {/* Personal Info */}
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Personal Information
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[14px]">First Name *</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Last Name *</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-[14px]">Middle Name</Label>
                    <Input
                      value={form.middleName}
                      onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Date of Birth *</Label>
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Gender *</Label>
                    <select
                      value={form.gender}
                      onChange={(e) =>
                        setForm({ ...form, gender: e.target.value as typeof form.gender })
                      }
                      className="text-base bg-background border border-border rounded-md h-11 px-3 w-full"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Contact Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[14px]">Contact Number</Label>
                    <Input
                      value={form.contactNumber}
                      onChange={(e) =>
                        setForm({ ...form, contactNumber: e.target.value })
                      }
                      placeholder="09XX-XXX-XXXX"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[14px]">Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-[14px]">City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Province</Label>
                    <Input
                      value={form.province}
                      onChange={(e) => setForm({ ...form, province: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">ZIP Code</Label>
                    <Input
                      value={form.zipCode}
                      onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Beneficiary */}
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Beneficiary
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[14px]">Beneficiary Name *</Label>
                    <Input
                      value={form.beneficiaryName}
                      onChange={(e) =>
                        setForm({ ...form, beneficiaryName: e.target.value })
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Relationship *</Label>
                    <Input
                      value={form.beneficiaryRelationship}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          beneficiaryRelationship: e.target.value,
                        })
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-[15px] font-semibold">
                Create Client
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Status filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by name or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-base h-11"
            />
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className="h-11 gap-2 px-4 text-[13.5px]"
            onClick={() => {
              setShowArchived((v) => !v);
              setSelectedIds(new Set());
            }}
          >
            <Archive className="h-4 w-4" />
            {showArchived ? "Showing archived" : "Show archived"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? clientCount
                : statusCounts[tab.key] || 0;
            return (
              <Button
                key={tab.key}
                variant={statusFilter === tab.key ? "default" : "outline"}
                size="sm"
                className="h-9 text-[13px] gap-2"
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label}
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-5 min-w-5 px-1.5 text-[11px]"
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/*
       * Bulk selection bar. Archiving is the normal way to take a planholder
       * out of the working lists and is available to Head Office and Branch
       * Managers. Permanent deletion is Head Office only and is refused by the
       * server once a planholder has any payment recorded.
       */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-cream/60 px-5 py-3">
          <div className="flex items-center gap-2 text-[15px] font-medium text-ink">
            <AlertTriangle className="h-5 w-5 text-gold" />
            {selectedIds.size} planholder{selectedIds.size !== 1 ? "s" : ""} selected
          </div>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="default"
            onClick={() => setSelectedIds(new Set())}
            className="h-10 text-[14px]"
          >
            Clear
          </Button>

          {showArchived ? (
            <Button
              variant="default"
              size="default"
              className="h-10 gap-2 text-[14px]"
              onClick={handleRestore}
              disabled={isArchiving || !canArchive}
            >
              <ArchiveRestore className="h-4 w-4" />
              Restore ({selectedIds.size})
            </Button>
          ) : (
            <Button
              variant="outline"
              size="default"
              className="h-10 gap-2 text-[14px]"
              onClick={() => setArchiveDialogOpen(true)}
              disabled={!canArchive}
              title={
                canArchive
                  ? "Remove from the working lists without deleting history"
                  : "Only a Branch Manager or Head Office can archive"
              }
            >
              <Archive className="h-4 w-4" />
              Archive ({selectedIds.size})
            </Button>
          )}

          {isCeoOrAdmin && !showArchived && (
            <Button
              variant="destructive"
              size="default"
              className="h-10 gap-2 text-[14px]"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      {/* Client table */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          <ScrollableTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false
                    }
                    onCheckedChange={toggleSelectVisible}
                    aria-label="Select all visible clients"
                  />
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Client
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Contact
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Status
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Plan
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filteredClients ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-base">
                    Loading clients...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-base text-muted-foreground">
                      {search || statusFilter !== "all"
                        ? "No clients match your filters"
                        : "No clients yet. Add one to get started."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                (pageClients ?? []).map(({ client, contract, computedStatus, daysSincePayment }) => {
                  const isSelected = selectedIds.has(String(client._id));
                  return (
                    <TableRow
                      key={client._id}
                      className={`cursor-pointer hover:bg-muted/50 ${
                        isSelected ? "bg-terminal-green/10 dark:bg-terminal-green/15" : ""
                      }`}
                      onClick={() => navigate(`/clients/${client._id}`)}
                    >
                      <TableCell
                        className="w-12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleClient(String(client._id))}
                          aria-label={`Select ${client.lastName}, ${client.firstName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="flex flex-wrap items-center gap-2 font-medium text-[15px]">
                          {client.lastName}, {client.firstName}
                          {client.archivedAt ? (
                            <Badge
                              variant="secondary"
                              className="gap-1 text-[11px]"
                            >
                              <Archive className="h-3 w-3" />
                              Archived
                            </Badge>
                          ) : null}
                        </p>
                        {client.middleName && (
                          <p className="text-[13px] text-muted-foreground">
                            {client.middleName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-[14px]">
                          {client.contactNumber || "—"}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                          {[client.city, client.province].filter(Boolean).join(", ") || "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={`text-[12px] ${
                              STATUS_COLORS[computedStatus] || ""
                            }`}
                          >
                            {STATUS_LABELS[computedStatus] || computedStatus.replace(/_/g, " ")}
                          </Badge>
                          {daysSincePayment !== null && computedStatus !== "no_contract" && (
                            <p className="text-[12px] text-muted-foreground">
                              {daysSincePayment}d since last payment
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contract ? (
                          <div>
                            <p className="text-[14px]">{contract.planType}</p>
                            <p className="text-[13px] text-muted-foreground">
                              {formatPHP(contract.monthlyAmortization)}/mo
                            </p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-9 px-3 gap-1.5 text-[14px]">
                          View <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </ScrollableTable>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
              <p className="text-[13px] text-muted-foreground">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, totalFiltered)} of{" "}
                {totalFiltered}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageItems.map((item, idx) =>
                  item === "gap" ? (
                    <span key={`gap-${idx}`} className="px-1 text-[13px] text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant={item === currentPage ? "default" : "outline"}
                      size="sm"
                      className="h-9 min-w-9 px-2 text-[13px]"
                      onClick={() => setPage(item)}
                    >
                      {item + 1}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Permanently delete {selectedIds.size} planholder
              {selectedIds.size !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p className="text-[15px]">
                This permanently deletes the selected records and their
                attached contracts, payments, receipts, and payment schedules.
              </p>
              <p className="rounded-lg border border-terminal-amber/30 bg-terminal-amber/10 px-3 py-2 text-[13px] text-ink">
                Deletion is refused for any planholder with recorded payments or
                receipts — a branch&apos;s collections and its historical
                reports must never be rewritten. Archive those instead.
              </p>
              {selectedNames.length > 0 && (
                <div className="pt-1">
                  <p className="text-[12px] uppercase tracking-wider text-muted-foreground mb-2">
                    Selected
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-[13px]">
                    {selectedNames.slice(0, 8).map((name) => (
                      <div key={name}>• {name}</div>
                    ))}
                    {selectedNames.length > 8 && (
                      <div className="text-muted-foreground">
                        …and {selectedNames.length - 8} more
                      </div>
                    )}
                  </div>
                </div>
              )}
              <p className="text-destructive font-medium pt-1">
                This action cannot be undone. Audit logs are kept for history.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="h-11 text-[14px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="gap-2 h-11 text-[14px]"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete {selectedIds.size} Client{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive (soft delete) confirmation */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Archive {selectedIds.size} planholder
              {selectedIds.size !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p className="text-[15px]">
                Archived planholders disappear from the working lists, search,
                reports, and aging views. Nothing is deleted:
              </p>
              <p className="text-[13px]">
                contracts · payments · receipts · audit trail
              </p>
              <p className="text-[13px] text-stone">
                They can be restored at any time from the archived view, and
                their historical totals stay exactly as recorded.
              </p>
              <div className="pt-1">
                <Label className="text-[13px]">Reason (optional)</Label>
                <Input
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g. duplicated record"
                  className="h-10 text-[14px]"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={isArchiving}
              className="h-11 text-[14px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              disabled={isArchiving}
              className="gap-2 h-11 text-[14px]"
            >
              {isArchiving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
