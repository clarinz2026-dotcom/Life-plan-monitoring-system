import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Users,
  FileText,
  MapPin,
  Phone,
  Edit2,
  Trash2,
  Wallet,
  Target,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollableTable } from "@/components/ScrollableTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Branches() {
  const branchSummary = useQuery(api.branches.summary);
  const branches = useQuery(api.branches.list);
  const users = useQuery(api.users.listWithBranches);
  const createBranch = useMutation(api.branches.create);
  const updateBranch = useMutation(api.branches.update);
  const removeBranch = useMutation(api.branches.remove);
  const assignBranch = useMutation(api.users.assignBranch);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    province: "",
    contactNumber: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    province: "",
    contactNumber: "",
  });

  const [assignForm, setAssignForm] = useState({
    userId: "",
    branchId: "",
  });

  const inputClass =
    "text-base bg-background border-border h-11 focus-visible:ring-ring";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBranch({
        name: form.name,
        code: form.code,
        address: form.address,
        city: form.city,
        province: form.province,
        contactNumber: form.contactNumber || undefined,
      });
      toast.success("Branch created successfully!");
      setCreateOpen(false);
      setForm({
        name: "",
        code: "",
        address: "",
        city: "",
        province: "",
        contactNumber: "",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create branch");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    try {
      await updateBranch({
        branchId: selectedBranch._id,
        name: editForm.name,
        code: editForm.code,
        address: editForm.address,
        city: editForm.city,
        province: editForm.province,
        contactNumber: editForm.contactNumber || undefined,
      });
      toast.success("Branch updated!");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update branch");
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignBranch({
        userId: assignForm.userId as any,
        branchId: assignForm.branchId
          ? (assignForm.branchId as any)
          : undefined,
      });
      toast.success("User branch assignment updated!");
      setAssignOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign branch");
    }
  };

  const handleDelete = async (branchId: string) => {
    setDeleting(true);
    try {
      await removeBranch({ branchId: branchId as any });
      toast.success("Branch deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete branch");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (b: any) => {
    setSelectedBranch(b);
    setEditForm({
      name: b.name,
      code: b.code,
      address: b.address,
      city: b.city,
      province: b.province,
      contactNumber: b.contactNumber || "",
    });
    setEditOpen(true);
  };

  const openAssign = () => {
    setAssignForm({ userId: "", branchId: "" });
    setAssignOpen(true);
  };

  const totalClients =
    branchSummary?.reduce((s, b) => s + b.clientCount, 0) ?? 0;
  const totalContracts =
    branchSummary?.reduce((s, b) => s + b.contractCount, 0) ?? 0;
  const totalCollected =
    branchSummary?.reduce((s, b) => s + b.totalCollected, 0) ?? 0;
  const totalContractValue =
    branchSummary?.reduce((s, b) => s + b.totalContractValue, 0) ?? 0;
  const overallRate =
    totalContractValue > 0
      ? Math.min(
          Math.round((totalCollected / totalContractValue) * 100),
          100,
        )
      : 0;

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branch Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {branchSummary?.length ?? 0} branches · {totalClients} total
            clients
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="default"
            className="gap-2 h-11 px-4 text-[15px]"
            onClick={openAssign}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Assign Staff</span>
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button
                size="default"
                className="gap-2 h-11 px-5 text-[15px]"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">New Branch</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  Add New Branch
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-3">
                <div>
                  <Label className="text-[14px]">Branch Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[14px]">Branch Code *</Label>
                    <Input
                      value={form.code}
                      onChange={(e) =>
                        setForm({ ...form, code: e.target.value })
                      }
                      placeholder="e.g. MBS-002"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Contact Number</Label>
                    <Input
                      value={form.contactNumber}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contactNumber: e.target.value,
                        })
                      }
                      placeholder="09XX-XXX-XXXX"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[14px]">Address *</Label>
                  <Input
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[14px]">City *</Label>
                    <Input
                      value={form.city}
                      onChange={(e) =>
                        setForm({ ...form, city: e.target.value })
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-[14px]">Province *</Label>
                    <Input
                      value={form.province}
                      onChange={(e) =>
                        setForm({ ...form, province: e.target.value })
                      }
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-[15px] font-semibold"
                >
                  Create Branch
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Total Clients
                </p>
                <p className="text-2xl font-bold mt-1">{totalClients}</p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-green-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Active Contracts
                </p>
                <p className="text-2xl font-bold mt-1">{totalContracts}</p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Total Collected
                </p>
                <p className="text-2xl font-bold mt-1">
                  {formatPHP(totalCollected)}
                </p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">
                  Collection Rate
                </p>
                <p className="text-2xl font-bold mt-1 text-green-600">
                  {overallRate}%
                </p>
              </div>
              <div className="h-11 w-11 rounded-lg bg-green-50 flex items-center justify-center">
                <Target className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch performance table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Branch Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!branchSummary ? (
            <p className="text-base text-muted-foreground py-8 text-center">
              Loading branch data...
            </p>
          ) : branchSummary.length === 0 ? (
            <div className="text-center py-14">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-base text-muted-foreground">
                No branches yet. Create your first branch to get started.
              </p>
            </div>
          ) : (
            <ScrollableTable>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                      Branch
                    </TableHead>
                    <TableHead className="text-[13px] uppercase tracking-wider font-medium text-center">
                      Clients
                    </TableHead>
                    <TableHead className="text-[13px] uppercase tracking-wider font-medium text-center">
                      Contracts
                    </TableHead>
                    <TableHead className="text-[13px] uppercase tracking-wider font-medium text-center">
                      Collection Rate
                    </TableHead>
                    <TableHead className="text-[13px] uppercase tracking-wider font-medium text-center">
                      This Month
                    </TableHead>
                    <TableHead className="text-[13px] uppercase tracking-wider font-medium text-center">
                      Staff
                    </TableHead>
                    <TableHead className="text-[13px] uppercase tracking-wider font-medium text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchSummary.map((b) => (
                    <TableRow key={b._id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-[15px]">
                            {b.name}
                          </p>
                          <p className="text-[12px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {b.city}, {b.province}
                          </p>
                          {b.contactNumber && (
                            <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {b.contactNumber}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-[15px] font-bold">
                          {b.clientCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-[15px] font-bold">
                          {b.contractCount}
                        </span>
                        {b.fullyPaidCount > 0 && (
                          <p className="text-[11px] text-green-600">
                            {b.fullyPaidCount} paid
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[15px] font-bold text-green-600">
                            {b.collectionRate}%
                          </span>
                          <div className="w-16 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-green-600 rounded-full"
                              style={{
                                width: `${b.collectionRate}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <p className="text-[15px] font-bold text-green-600">
                          {formatPHP(b.monthAmount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {b.monthPayments} payments
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-[15px] font-bold">
                          {b.staffCount}
                        </span>
                        {b.managerName && (
                          <p className="text-[11px] text-muted-foreground">
                            Mgr: {b.managerName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEdit(b)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(b._id)}
                            disabled={deleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </CardContent>
      </Card>

      {/* Branch detail cards */}
      {branchSummary && branchSummary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {branchSummary.map((b) => (
            <Card
              key={b._id}
              className="border-border/60 shadow-sm hover:border-border transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-600" />
                    {b.code}
                  </CardTitle>
                  <Badge
                    variant={b.isActive ? "default" : "secondary"}
                    className="text-[11px]"
                  >
                    {b.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[14px] font-medium">{b.name}</p>
                <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {b.address}, {b.city}, {b.province}
                </p>
                {b.contactNumber && (
                  <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {b.contactNumber}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/40">
                  <div className="text-center">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Clients
                    </p>
                    <p className="text-[16px] font-bold">{b.clientCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Contracts
                    </p>
                    <p className="text-[16px] font-bold">
                      {b.contractCount}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Staff
                    </p>
                    <p className="text-[16px] font-bold">{b.staffCount}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      Collection Rate
                    </span>
                    <span className="font-semibold text-green-600">
                      {b.collectionRate}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="font-semibold">
                      {formatPHP(b.totalCollected)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      Contract Value
                    </span>
                    <span className="font-semibold">
                      {formatPHP(b.totalContractValue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      This Month
                    </span>
                    <span className="font-semibold text-green-600">
                      {formatPHP(b.monthAmount)}
                    </span>
                  </div>
                </div>

                {b.managerName && (
                  <div className="pt-3 border-t border-border/40">
                    <p className="text-[12px] text-muted-foreground">
                      Manager:{" "}
                      <span className="font-medium text-foreground">
                        {b.managerName}
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Branch Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Edit Branch
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-3">
            <div>
              <Label className="text-[14px]">Branch Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className={inputClass}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[14px]">Branch Code *</Label>
                <Input
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm({ ...editForm, code: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <Label className="text-[14px]">Contact Number</Label>
                <Input
                  value={editForm.contactNumber}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      contactNumber: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <Label className="text-[14px]">Address *</Label>
              <Input
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
                className={inputClass}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[14px]">City *</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) =>
                    setEditForm({ ...editForm, city: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <Label className="text-[14px]">Province *</Label>
                <Input
                  value={editForm.province}
                  onChange={(e) =>
                    setEditForm({ ...editForm, province: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-[15px] font-semibold"
            >
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Assign Staff to Branch
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4 mt-3">
            <div>
              <Label className="text-[14px]">Staff Member *</Label>
              <select
                value={assignForm.userId}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, userId: e.target.value })
                }
                className="text-base bg-background border border-border rounded-md h-11 px-3 w-full"
                required
              >
                <option value="">Select staff member...</option>
                {users?.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name || u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[14px]">Branch *</Label>
              <select
                value={assignForm.branchId}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, branchId: e.target.value })
                }
                className="text-base bg-background border border-border rounded-md h-11 px-3 w-full"
                required
              >
                <option value="">Select branch...</option>
                {branches?.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-[15px] font-semibold"
            >
              Assign
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
