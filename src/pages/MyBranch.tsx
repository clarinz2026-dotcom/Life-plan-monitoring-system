import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ScrollableTable";
import { useBranch } from "@/hooks/use-branch";
import { BranchScopeSelector } from "@/components/BranchScopeSelector";
import { Link } from "react-router";
import {
  Building2,
  Users,
  FileText,
  Wallet,
  Target,
  MapPin,
  Phone,
  Mail,
  Clock,
  CalendarDays,
  Receipt,
  Edit2,
  UserPlus,
  ArrowRightLeft,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const POSITION_OPTIONS = [
  { value: "branch_manager", label: "Branch Manager" },
  { value: "collector", label: "Collector" },
  { value: "cashier", label: "Cashier" },
] as const;

const inputClass =
  "text-base bg-background border-border h-11 focus-visible:ring-ring";

/**
 * The branch workspace.
 *
 * Head Office sees whichever branch is selected in the `[ ALL BRANCHES ▼ ]`
 * control; a Branch Manager sees their own branch automatically, with no
 * selector to change, because their account is bound to exactly one branch.
 * Every figure on this page comes from branch-scoped queries, so a manager can
 * never see another branch's people, collections, or transfers.
 */
export default function MyBranch() {
  const { branchId, isCeoOrAdmin, isManager } = useBranch();

  const summaries = useQuery(api.branches.summary);
  const branch = useQuery(api.branches.get, branchId ? { branchId } : "skip");
  // Head Office asks for the branch it has selected; branch staff get their own
  // regardless of what is passed, because the server resolves their branch from
  // their account.
  const team = useQuery(api.users.branchTeam, {
    branchId: branchId ?? undefined,
  });
  const unassigned = useQuery(
    api.users.unassignedStaff,
    isCeoOrAdmin || isManager ? {} : "skip"
  );
  const transfers = useQuery(api.branches.transferHistory, { limit: 25 });

  const updateSettings = useMutation(api.branches.updateSettings);
  const assignBranch = useMutation(api.users.assignBranch);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    address: "",
    city: "",
    province: "",
    contactNumber: "",
    email: "",
    operatingHours: "",
    receiptPrefix: "",
  });

  const [teamForm, setTeamForm] = useState({
    userId: "",
    position: "",
  });

  const canEditSettings = isCeoOrAdmin || isManager;

  // For branch staff the summary query returns exactly one row (their branch).
  // For Head Office, the row for the branch currently selected.
  const summary =
    summaries?.find((s) => s._id === branchId) ??
    (!isCeoOrAdmin ? summaries?.[0] : undefined) ??
    null;

  const openSettings = () => {
    if (!branch) return;
    setSettingsForm({
      address: branch.address ?? "",
      city: branch.city ?? "",
      province: branch.province ?? "",
      contactNumber: branch.contactNumber ?? "",
      email: branch.email ?? "",
      operatingHours: branch.operatingHours ?? "",
      receiptPrefix: branch.receiptPrefix ?? "",
    });
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return;
    setSavingSettings(true);
    try {
      await updateSettings({
        branchId: branch._id,
        address: settingsForm.address,
        city: settingsForm.city,
        province: settingsForm.province,
        contactNumber: settingsForm.contactNumber || undefined,
        email: settingsForm.email || undefined,
        operatingHours: settingsForm.operatingHours || undefined,
        receiptPrefix: settingsForm.receiptPrefix || undefined,
      });
      toast.success("Branch settings saved.");
      setSettingsOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save branch settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return;
    // Both pickers are Radix Selects (buttons, not form controls), so the
    // browser's `required` validation no longer guards them.
    if (!teamForm.userId) {
      toast.error("Choose the staff account to assign.");
      return;
    }
    if (!teamForm.position) {
      toast.error("Choose a position for this staff member.");
      return;
    }
    try {
      await assignBranch({
        userId: teamForm.userId as any,
        // Always the branch on screen — the server also rejects anything else
        // for a manager, so this can't be used to reach another branch.
        branchId: branch._id,
        position: (teamForm.position || undefined) as any,
      });
      toast.success("Team member assigned.");
      setTeamOpen(false);
      setTeamForm({ userId: "", position: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign team member");
    }
  };

  // Head Office with no branch picked — point them at the selector rather than
  // silently showing one arbitrary branch.
  if (isCeoOrAdmin && !branchId) {
    return (
      <div className="p-5 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Branch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a branch to work inside it.
          </p>
        </div>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-evergreen/10">
              <Layers className="h-6 w-6 text-evergreen" />
            </div>
            <div>
              <p className="text-[15px] font-semibold">
                You are viewing All Branches
              </p>
              <p className="mt-1 max-w-md text-[13.5px] text-muted-foreground">
                Choose a branch from the scope selector to see its roster,
                settings, and performance — or open Branch Management for the
                side-by-side comparison.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <BranchScopeSelector />
              <Button variant="outline" asChild>
                <Link to="/branches">Branch Management</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!branch || !summary) {
    return (
      <div className="p-5 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Branch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Loading this branch…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{branch.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono text-[12.5px] tracking-wide">
              {branch.code}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {branch.city}, {branch.province}
            </span>
            <Badge
              variant={branch.isActive ? "default" : "secondary"}
              className="text-[11px]"
            >
              {branch.isActive ? "Active" : "Inactive"}
            </Badge>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCeoOrAdmin && <BranchScopeSelector />}
          {canEditSettings && (
            <Button
              variant="outline"
              className="h-11 gap-2 px-4 text-[15px]"
              onClick={openSettings}
            >
              <Edit2 className="h-4 w-4" />
              Branch settings
            </Button>
          )}
          {(isCeoOrAdmin || isManager) && (
            <Button
              className="h-11 gap-2 px-5 text-[15px]"
              onClick={() => {
                setTeamForm({ userId: "", position: "" });
                setTeamOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              Assign staff
            </Button>
          )}
        </div>
      </div>

      {/* Branch-scoped metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                  Clients
                </p>
                <p className="mt-1 text-2xl font-bold">{summary.clientCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-terminal-green/10">
                <Users className="h-5 w-5 text-terminal-green" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                  Contracts
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {summary.contractCount}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-evergreen/10">
                <FileText className="h-5 w-5 text-evergreen" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                  Collected
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {formatPHP(summary.totalCollected)}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-terminal-green/10">
                <Wallet className="h-5 w-5 text-terminal-green" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                  Collection rate
                </p>
                <p className="mt-1 text-2xl font-bold text-terminal-green">
                  {summary.collectionRate}%
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-terminal-green/10">
                <Target className="h-5 w-5 text-terminal-green" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Profile + branch settings */}
        <Card className="border-border/60 shadow-sm lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Branch profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <ProfileRow icon={MapPin} label="Address">
              {branch.address}
              <br />
              {branch.city}, {branch.province}
            </ProfileRow>
            <ProfileRow icon={Phone} label="Contact">
              {branch.contactNumber || "— not set —"}
            </ProfileRow>
            <ProfileRow icon={Mail} label="Email">
              {branch.email || "— not set —"}
            </ProfileRow>
            <ProfileRow icon={Clock} label="Operating hours">
              {branch.operatingHours || "— not set —"}
            </ProfileRow>
            <ProfileRow icon={Receipt} label="Receipt prefix">
              {branch.receiptPrefix || "— not set —"}
            </ProfileRow>
            <ProfileRow icon={CalendarDays} label="Opening date">
              {new Date(
                branch.openingDate ?? branch.createdAt
              ).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </ProfileRow>
            <ProfileRow icon={ShieldCheck} label="Branch manager">
              {summary.managerName || "— not set —"}
            </ProfileRow>

            <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3.5">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">
                  This month
                </p>
                <p className="text-[16px] font-semibold text-terminal-green">
                  {formatPHP(summary.monthAmount)}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  {summary.monthPayments} payments
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">
                  Fully paid
                </p>
                <p className="text-[16px] font-semibold">
                  {summary.fullyPaidCount}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  of {summary.contractCount} contracts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team roster */}
        <Card className="border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
              <Users className="h-5 w-5 text-muted-foreground" />
              Branch team
              <span className="text-[13px] font-normal text-muted-foreground">
                ({team?.length ?? 0})
              </span>
            </CardTitle>
            {(isCeoOrAdmin || isManager) && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-full px-3.5 text-[13.5px]"
                onClick={() => {
                  setTeamForm({ userId: "", position: "" });
                  setTeamOpen(true);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!team ? (
              <p className="py-8 text-center text-base text-muted-foreground">
                Loading team…
              </p>
            ) : team.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-base text-muted-foreground">
                  No staff assigned to this branch yet.
                </p>
              </div>
            ) : (
              <ScrollableTable>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                        Staff
                      </TableHead>
                      <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                        Position
                      </TableHead>
                      <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                        Access
                      </TableHead>
                      <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                        Joined
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.map((member) => (
                      <TableRow key={member._id} className="hover:bg-muted/50">
                        <TableCell>
                          <p className="text-[14.5px] font-medium">
                            {member.name || member.email || "Unnamed account"}
                          </p>
                          {member.name && member.email && (
                            <p className="mt-0.5 text-[12px] text-muted-foreground">
                              {member.email}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.positionLabel ? (
                            <Badge variant="secondary" className="text-[11.5px]">
                              {member.positionLabel}
                            </Badge>
                          ) : (
                            <span className="text-[13px] text-muted-foreground">
                              — not set —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-[13px] text-muted-foreground">
                            {member.role ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[13px] text-muted-foreground">
                            {new Date(member.joinedAt).toLocaleDateString(
                              "en-PH"
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transfers touching this branch */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
            <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            Planholder transfers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!transfers ? (
            <p className="py-8 text-center text-base text-muted-foreground">
              Loading transfers…
            </p>
          ) : transfers.length === 0 ? (
            <p className="py-8 text-center text-base text-muted-foreground">
              No planholder has been transferred into or out of this branch.
            </p>
          ) : (
            <ScrollableTable>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                      Planholder
                    </TableHead>
                    <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                      From
                    </TableHead>
                    <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                      To
                    </TableHead>
                    <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                      Reason
                    </TableHead>
                    <TableHead className="text-[13px] font-medium uppercase tracking-wider">
                      Moved
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t) => (
                    <TableRow key={t._id} className="hover:bg-muted/50">
                      <TableCell className="text-[14px] font-medium">
                        {t.clientName}
                      </TableCell>
                      <TableCell className="text-[13.5px] text-muted-foreground">
                        {t.fromBranchName || "— unassigned —"}
                      </TableCell>
                      <TableCell className="text-[13.5px] text-muted-foreground">
                        {t.toBranchName}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-[13.5px] text-muted-foreground">
                        {t.reason || "—"}
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("en-PH")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTable>
          )}
        </CardContent>
      </Card>

      {/* Branch settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="mx-2 max-h-[85vh] max-w-lg overflow-y-auto sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Branch settings
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="mt-3 space-y-4">
            <div>
              <Label className="text-[14px]">Address</Label>
              <Input
                value={settingsForm.address}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, address: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[14px]">City</Label>
                <Input
                  value={settingsForm.city}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, city: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <Label className="text-[14px]">Province</Label>
                <Input
                  value={settingsForm.province}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      province: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[14px]">Contact number</Label>
                <Input
                  value={settingsForm.contactNumber}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      contactNumber: e.target.value,
                    })
                  }
                  placeholder="09XX-XXX-XXXX"
                  className={inputClass}
                />
              </div>
              <div>
                <Label className="text-[14px]">Email</Label>
                <Input
                  type="email"
                  value={settingsForm.email}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, email: e.target.value })
                  }
                  placeholder="branch@evangelistfuneral.com"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[14px]">Operating hours</Label>
                <Input
                  value={settingsForm.operatingHours}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      operatingHours: e.target.value,
                    })
                  }
                  placeholder="Mon–Sat, 8:00 AM – 5:00 PM"
                  className={inputClass}
                />
              </div>
              <div>
                <Label className="text-[14px]">Receipt prefix</Label>
                <Input
                  value={settingsForm.receiptPrefix}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      receiptPrefix: e.target.value,
                    })
                  }
                  placeholder="e.g. OPL"
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Company-wide settings — company name, logo, plan catalog, and
              security policy — are managed centrally under Branding and Plans.
            </p>
            <Button
              type="submit"
              disabled={savingSettings}
              className="h-12 w-full text-[15px] font-semibold"
            >
              {savingSettings ? "Saving…" : "Save settings"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign staff dialog */}
      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="mx-2 max-w-md sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Assign staff to {branch.code}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="mt-3 space-y-4">
            <p className="rounded-xl border border-line bg-cream/60 px-3.5 py-3 text-[12.5px] leading-relaxed text-stone">
              Staff assigned here are created inside{" "}
              <span className="font-semibold text-ink">{branch.name}</span> and
              can only ever see this branch&apos;s clients, payments, and
              reports. A Branch Manager can add to their own branch and cannot
              move anyone into another one.
            </p>
            <div>
              <Label className="text-[14px]">Staff account *</Label>
              <Select
                value={teamForm.userId}
                onValueChange={(value) =>
                  setTeamForm({ ...teamForm, userId: value })
                }
              >
                <SelectTrigger className="w-full! h-11! text-base">
                  <SelectValue placeholder="Select an account…" />
                </SelectTrigger>
                <SelectContent>
                  {team?.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name || m.email} — currently{" "}
                      {m.positionLabel || m.role || "unassigned"}
                    </SelectItem>
                  ))}
                  {unassigned?.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name || u.email} — not in a branch
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[14px]">Position *</Label>
              <Select
                value={teamForm.position}
                onValueChange={(value) =>
                  setTeamForm({ ...teamForm, position: value })
                }
              >
                <SelectTrigger className="w-full! h-11! text-base">
                  <SelectValue placeholder="Select position…" />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              className="h-12 w-full text-[15px] font-semibold"
            >
              Assign to this branch
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
