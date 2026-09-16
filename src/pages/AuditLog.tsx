import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  User,
  FileText,
  CreditCard,
  Users,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useBranch } from "@/hooks/use-branch";

const ACTION_COLORS: Record<string, string> = {
  create: "terminal-status-current",
  update: "terminal-status-delinquent",
  delete: "terminal-status-claim",
  status_change: "terminal-status-paid",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  status_change: "Status Changed",
};

const ENTITY_ICONS: Record<string, typeof Users> = {
  client: Users,
  contract: FileText,
  payment: CreditCard,
  receipt: FileText,
};

export default function AuditLog() {
  const [limit, setLimit] = useState(50);
  // Head Office's branch scope narrows the trail; branch staff are always
  // narrowed to their own branch by the server.
  const { queryBranchId, isCeoOrAdmin } = useBranch();

  const logs = useQuery(api.audit.list, {
    limit,
    branchId: queryBranchId,
  });

  if (!logs) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-base text-muted-foreground">Loading audit log...</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {logs.length} entries ·{" "}
            {isCeoOrAdmin && !queryBranchId
              ? "all branches"
              : "this branch"}
          </p>
        </div>
        <Button
          variant="outline"
          size="default"
          className="gap-2 h-11 px-5 text-[15px]"
          onClick={() => setLimit(limit + 50)}
        >
          <RefreshCw className="h-5 w-5" />
          Load More
        </Button>
      </div>

      {/* Log Entries */}
      {logs.length === 0 ? (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="py-10 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-base text-muted-foreground">
              No audit entries yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const Icon = ENTITY_ICONS[log.entityType] || FileText;
            return (
              <Card key={log._id} className="border-border/60 shadow-sm">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="mt-0.5">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[12px] ${ACTION_COLORS[log.action] || ""}`}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                        <span className="text-[13px] text-muted-foreground capitalize">
                          {log.entityType}
                        </span>
                      </div>
                      <p className="text-[15px] mt-1.5">{log.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[13px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          {log.userName}
                        </span>
                        <span>
                          {format(new Date(log.timestamp), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>

                      {log.oldValues && log.newValues && (
                        <div className="mt-2 p-2.5 bg-muted/50 rounded-lg text-[13px]">
                          <div className="flex gap-4">
                            {log.oldValues.contractStatus && (
                              <span className="text-muted-foreground">
                                <span className="line-through">{log.oldValues.contractStatus}</span>
                                {" → "}
                                <span className="text-terminal-green font-medium">
                                  {log.newValues.contractStatus}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
