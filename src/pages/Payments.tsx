import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBranch } from "@/hooks/use-branch";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { CreditCard, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ScrollableTable } from "@/components/ScrollableTable";

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Payments() {
  const { queryBranchId } = useBranch();
  const payments = useQuery(api.payments.list, { branchId: queryBranchId });
  const contracts = useQuery(api.contracts.list, { branchId: queryBranchId });
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const recordPayment = useMutation(api.payments.record);

  const [form, setForm] = useState({
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

  const activeContracts =
    contracts?.filter((c) => c.contractStatus !== "fully_paid") || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await recordPayment({
        contractId: form.contractId as any,
        amount: Number(form.amount),
        paymentChannel: form.paymentChannel,
        paymentDate: form.paymentDate
          ? new Date(form.paymentDate).getTime()
          : Date.now(),
        orNumber: form.orNumber || undefined,
        referenceNumber: form.referenceNumber || undefined,
        chequeNumber: form.chequeNumber || undefined,
        bankName: form.bankName || undefined,
        remarks: form.remarks || undefined,
      });
      toast.success(`Payment recorded! Receipt: ${result.receiptNumber}`);
      setDialogOpen(false);
      setForm({
        contractId: "",
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
      toast.error(
        err instanceof Error ? err.message : "Failed to record payment"
      );
    }
  };

  const inputClass = "text-base bg-background border-border h-11";

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {payments?.length || 0} total payment{(payments?.length || 0) !== 1 && "s"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="default" className="gap-2 h-11 px-5 text-[15px]">
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Record</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-2 sm:mx-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Record Payment
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-3">
              <div>
                <Label className="text-[14px]">Contract *</Label>
                <select
                  value={form.contractId}
                  onChange={(e) =>
                    setForm({ ...form, contractId: e.target.value })
                  }
                  className="text-base bg-background border border-border rounded-md h-11 px-3 w-full"
                  required
                >
                  <option value="">Select contract...</option>
                  {activeContracts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.contractNumber} — {c.client?.lastName},{" "}
                      {c.client?.firstName} — {c.planType} (
                      {formatPHP(c.planAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[14px]">Amount (₱) *</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <Label className="text-[14px]">Channel *</Label>
                  <select
                    value={form.paymentChannel}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentChannel: e.target.value as typeof form.paymentChannel,
                      })
                    }
                    className="text-base bg-background border border-border rounded-md h-11 px-3 w-full"
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
                <Input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) =>
                    setForm({ ...form, paymentDate: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Reference Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {form.paymentChannel === "check" && (
                    <>
                      <div>
                        <Label className="text-[14px]">Cheque Number</Label>
                        <Input
                          value={form.chequeNumber}
                          onChange={(e) =>
                            setForm({ ...form, chequeNumber: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <Label className="text-[14px]">Bank Name</Label>
                        <Input
                          value={form.bankName}
                          onChange={(e) =>
                            setForm({ ...form, bankName: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                    </>
                  )}
                  {(form.paymentChannel === "gcash" ||
                    form.paymentChannel === "maya" ||
                    form.paymentChannel === "bank_transfer") && (
                    <div className="col-span-2">
                      <Label className="text-[14px]">Reference Number</Label>
                      <Input
                        value={form.referenceNumber}
                        onChange={(e) =>
                          setForm({ ...form, referenceNumber: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-[14px]">Remarks</Label>
                <Input
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                  placeholder="Optional notes..."
                  className={inputClass}
                />
              </div>

              <Button type="submit" className="w-full h-12 text-[15px] font-semibold">
                Record Payment & Issue Receipt
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment table */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          <ScrollableTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Date
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Client
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Contract
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Channel
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  OR #
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium text-right">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!payments ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-base">
                    Loading payments...
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-base text-muted-foreground">
                      No payments recorded yet
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow
                    key={p._id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="text-[14px]">
                      {format(new Date(p.paymentDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <p className="text-[15px]">
                        {p.client
                          ? `${p.client.lastName}, ${p.client.firstName}`
                          : "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {p.contract?.contractNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[12px]">
                        {p.paymentChannel.toUpperCase().replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[14px] text-muted-foreground">
                      {p.orNumber || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-green-600 text-[15px]">
                        {formatPHP(p.amount)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </ScrollableTable>
        </CardContent>
      </Card>
    </div>
  );
}
