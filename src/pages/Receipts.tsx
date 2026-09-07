import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt as ReceiptIcon, Printer } from "lucide-react";
import { ScrollableTable } from "@/components/ScrollableTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { printThermalReceipt } from "@/components/ThermalReceipt";
import { useBranch } from "@/hooks/use-branch";

const CHANNEL_LABELS: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  check: "Check",
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Receipts() {
  const { queryBranchId } = useBranch();
  const receipts = useQuery(api.receipts.list, { branchId: queryBranchId });
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Receipts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Official receipts issued for payments
        </p>
      </div>

      {/* Receipt table */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          <ScrollableTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Receipt #
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Date
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Issued To
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Plan
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Channel
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium">
                  Status
                </TableHead>
                <TableHead className="text-[13px] uppercase tracking-wider font-medium text-right">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!receipts ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-base">
                    Loading receipts...
                  </TableCell>
                </TableRow>
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <ReceiptIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-base text-muted-foreground">
                      No receipts issued yet
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((r) => (
                  <TableRow
                    key={r._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedReceipt(r)}
                  >
                    <TableCell className="text-[14px] font-medium">
                      {r.receiptNumber}
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {format(new Date(r.paymentDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <p className="text-[15px]">{r.issuedTo}</p>
                    </TableCell>
                    <TableCell className="text-[14px]">
                      {r.planType}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[12px]">
                        {CHANNEL_LABELS[r.paymentChannel] || r.paymentChannel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[12px] ${
                          r.status === "active"
                            ? "terminal-status-current"
                            : r.status === "cancelled"
                              ? "terminal-status-claim"
                              : "text-muted-foreground"
                        }`}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-green-600 text-[15px]">
                        {formatPHP(r.amount)}
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

      {/* Receipt detail dialog */}
      <Dialog
        open={!!selectedReceipt}
        onOpenChange={(open) => !open && setSelectedReceipt(null)}
      >
        <DialogContent className="max-w-md mx-2 sm:mx-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Official Receipt
            </DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="border border-border rounded-lg p-6 space-y-4 bg-white">
              {/* Receipt header */}
              <div className="text-center border-b border-border pb-4">
                <h3 className="font-bold text-xl tracking-tight">Evangelist Funeral Services</h3>
                <p className="text-[12px] text-muted-foreground uppercase tracking-wider mt-1">
                  Pre-Need Funeral &amp; Deathcare Services
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Official Receipt
                </p>
              </div>

              {/* Receipt number */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[12px] text-muted-foreground uppercase">
                    Receipt No.
                  </p>
                  <p className="text-[15px] font-bold">
                    {selectedReceipt.receiptNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-muted-foreground uppercase">
                    Date
                  </p>
                  <p className="text-[15px]">
                    {format(
                      new Date(selectedReceipt.paymentDate),
                      "MMMM d, yyyy"
                    )}
                  </p>
                </div>
              </div>

              {/* Client info */}
              <div className="space-y-1 border-t border-border pt-3">
                <p className="text-[12px] text-muted-foreground uppercase">
                  Received From
                </p>
                <p className="text-[15px] font-medium">{selectedReceipt.issuedTo}</p>
              </div>

              {/* Plan info */}
              <div className="space-y-1">
                <p className="text-[12px] text-muted-foreground uppercase">
                  Contract
                </p>
                <p className="text-[15px]">
                  {selectedReceipt.contractNumber}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {selectedReceipt.planType}
                </p>
              </div>

              {/* Amount */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-baseline">
                  <p className="text-[12px] text-muted-foreground uppercase">
                    Amount Paid
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPHP(selectedReceipt.amount)}
                  </p>
                </div>
                <p className="text-[12px] text-muted-foreground text-right mt-1">
                  via {CHANNEL_LABELS[selectedReceipt.paymentChannel] || selectedReceipt.paymentChannel}
                </p>
              </div>

              {/* Thermal Print Button */}
              <Button
                variant="outline"
                size="default"
                className="w-full gap-2 h-11 text-[14px]"
                onClick={() =>
                  printThermalReceipt({
                    receiptNumber: selectedReceipt.receiptNumber,
                    amount: selectedReceipt.amount,
                    paymentChannel: selectedReceipt.paymentChannel,
                    paymentDate: selectedReceipt.paymentDate,
                    issuedTo: selectedReceipt.issuedTo,
                    planType: selectedReceipt.planType,
                    contractNumber: selectedReceipt.contractNumber,
                    issuedByName: "Staff",
                    companyName: "Evangelist Funeral Services",
                  })
                }
              >
                <Printer className="h-4 w-4" /> Print Thermal Receipt
              </Button>

              {/* Status */}
              <div className="text-center pt-2">
                <Badge
                  variant="outline"
                  className={`text-[12px] ${
                    selectedReceipt.status === "active"
                      ? "terminal-status-current"
                      : "terminal-status-claim"
                  }`}
                >
                  {selectedReceipt.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
