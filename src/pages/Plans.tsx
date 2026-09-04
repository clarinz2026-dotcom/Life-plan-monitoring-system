import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Package, Shield, Plus, Pencil, Trash2, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

interface PlanFormState {
  name: string;
  price: string;
}

const EMPTY_FORM: PlanFormState = { name: "", price: "" };
const peso = (n: number) => `₱${n.toLocaleString()}`;
const PLAN_TERM_MONTHS = 60;
const fullPlanPrice = (monthly: number): number => Math.round(monthly * PLAN_TERM_MONTHS);

const planMonthly = (plan: { price: number; monthlyRate?: number }): number => {
  if (plan.monthlyRate && plan.monthlyRate > 0) return plan.monthlyRate;
  if (plan.price > 0 && plan.price % PLAN_TERM_MONTHS === 0) {
    const legacyMonthly = plan.price / PLAN_TERM_MONTHS;
    if (legacyMonthly >= 50 && legacyMonthly <= 5000) return legacyMonthly;
  }
  return plan.price;
};

export default function Plans() {
  const roleData = useQuery(api.users.hasRole);
  const plans = useQuery(api.plans.list) ?? [];
  const contracts = useQuery(api.contracts.list, {}) ?? [];
  const createPlan = useMutation(api.plans.create);
  const updatePlan = useMutation(api.plans.update);
  const removePlan = useMutation(api.plans.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ _id: string; name: string; price: number } | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = roleData?.role === "super_admin" || roleData?.role === "ceo";

  const contractCountByPlan = (planName: string) =>
    contracts.filter((c) => c.planType.toLowerCase().trim() === planName.toLowerCase().trim()).length;

  const openCreate = () => { setEditingPlan(null); setForm(EMPTY_FORM); setDialogOpen(true); };

  const openEdit = (plan: (typeof plans)[number]) => {
    const monthly = planMonthly(plan);
    setEditingPlan({ _id: plan._id, name: plan.name, price: monthly });
    setForm({ name: plan.name, price: String(monthly) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const monthly = parseFloat(form.price.replace(/,/g, ""));
    if (!name) { toast.error("Plan name is required."); return; }
    if (isNaN(monthly) || monthly <= 0) { toast.error("Enter a valid monthly payment greater than 0."); return; }
    setIsSaving(true);
    try {
      if (editingPlan) {
        const original = plans.find((p) => String(p._id) === editingPlan._id);
        await updatePlan({ planId: editingPlan._id as any, name, price: monthly, monthlyRate: monthly, oldPrice: original?.oldPrice });
        toast.success(`Plan "${name}" updated.`);
      } else {
        await createPlan({ name, price: monthly, monthlyRate: monthly });
        toast.success(`Plan "${name}" created.`);
      }
      setDialogOpen(false);
    } catch (error: any) { toast.error(error?.message || "Could not save the plan."); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (plan: (typeof plans)[number]) => {
    setIsDeleting(true);
    try { await removePlan({ planId: plan._id as any }); toast.success(`Plan "${plan.name}" removed.`); setDeletingId(null); }
    catch (error: any) { toast.error(error?.message || "Could not remove the plan."); }
    finally { setIsDeleting(false); }
  };

  if (!roleData) return <div className="p-6 text-base text-muted-foreground">Loading...</div>;
  if (!canManage) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Shield className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Access Denied</h2>
      <p className="text-base text-muted-foreground">Only the Super Admin or CEO can manage plans.</p>
    </div>
  );

  const activePlans = plans.filter((p) => p.isActive !== false).length;

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
          <Package className="h-6 w-6 text-green-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan types priced by <span className="font-semibold text-foreground">monthly payment</span> — full price = monthly × 60.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 h-11 px-5 text-[15px]">
          <Plus className="h-5 w-5" /> Add Plan
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60 shadow-sm"><CardContent className="p-5">
          <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">Total Plans</p>
          <p className="text-2xl font-bold mt-1">{plans.length}</p>
        </CardContent></Card>
        <Card className="border-border/60 shadow-sm"><CardContent className="p-5">
          <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">Active Plans</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{activePlans}</p>
        </CardContent></Card>
        <Card className="border-border/60 shadow-sm"><CardContent className="p-5">
          <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-medium">Contracts on Plans</p>
          <p className="text-2xl font-bold mt-1">{contracts.length}</p>
        </CardContent></Card>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-4 text-[14px] text-muted-foreground">
        <Info className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
        <p>Bulk upload matches the "Plan Type" column against plan names <span className="font-semibold text-foreground">case-insensitively</span> and auto-creates a contract.</p>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Plan Catalog ({plans.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {plans.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-base text-muted-foreground">No plans yet — add your first plan to start auto-creating contracts.</p>
            </div>
          ) : (
            <table className="w-full min-w-[700px]">
              <thead><tr className="border-b border-border">
                {["Plan Name", "Monthly Payment", "Full Price", "Contracts", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left py-3 px-5 text-[13px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {plans.map((plan) => {
                  const usage = contractCountByPlan(plan.name);
                  const isActive = plan.isActive !== false;
                  return (
                    <tr key={plan._id} className="border-b border-border/30 last:border-0">
                      <td className="py-3 px-5 font-medium text-[15px] whitespace-nowrap">{plan.name}</td>
                      <td className="py-3 px-5 text-[14px]">{peso(planMonthly(plan))}<span className="text-muted-foreground"> /mo</span></td>
                      <td className="py-3 px-5 text-[14px] text-muted-foreground">{peso(fullPlanPrice(planMonthly(plan)))}</td>
                      <td className="py-3 px-5">
                        {usage > 0 ? <Badge variant="outline" className="text-[12px] terminal-status-current">{usage}</Badge> : <span className="text-[14px] text-muted-foreground">0</span>}
                      </td>
                      <td className="py-3 px-5">
                        {isActive ? <Badge variant="outline" className="text-[12px] terminal-status-current">active</Badge> : <Badge variant="outline" className="text-[12px] terminal-status-claim">inactive</Badge>}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(plan)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeletingId(plan._id as any)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editingPlan ? "Edit Plan" : "New Plan"}</DialogTitle>
            <DialogDescription>{editingPlan ? "Update the plan name or pricing." : "Create a plan type that bulk upload can match against."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-[14px]">Plan Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Isidore" className="text-base h-11 mt-1.5" /></div>
            <div><Label className="text-[14px]">Monthly Payment (₱) *</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="e.g. 650" className="text-base h-11 mt-1.5" /></div>
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-[14px] flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Full price (monthly × {PLAN_TERM_MONTHS})</span>
              <span className="font-bold text-green-600 whitespace-nowrap">{(() => { const monthly = parseFloat(form.price.replace(/,/g, "")); return !isNaN(monthly) && monthly > 0 ? peso(fullPlanPrice(monthly)) : "—"; })()}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving} className="h-11 text-[14px]">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2 h-11 text-[14px]">{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{editingPlan ? "Save Changes" : "Create Plan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Remove Plan?</DialogTitle>
            <DialogDescription>{(() => { const plan = plans.find((p) => String(p._id) === deletingId); if (!plan) return null; const usage = contractCountByPlan(plan.name); return usage > 0 ? `"${plan.name}" is used by ${usage} contract${usage !== 1 ? "s" : ""} and cannot be removed.` : `This permanently removes "${plan.name}" from the plan catalog.`; })()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={isDeleting} className="h-11 text-[14px]">Cancel</Button>
            <Button variant="destructive" onClick={() => { const plan = plans.find((p) => String(p._id) === deletingId); if (plan) handleDelete(plan); }} disabled={isDeleting || contractCountByPlan(plans.find((p) => String(p._id) === deletingId)?.name ?? "") > 0} className="gap-2 h-11 text-[14px]">{isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}{!isDeleting && <Trash2 className="h-4 w-4" />}Remove Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
