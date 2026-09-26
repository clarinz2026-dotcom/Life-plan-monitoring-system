import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  BellRing,
  AlertTriangle,
  DollarSign,
  FileText,
  Settings,
  Check,
  CheckCheck,
} from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  payment_reminder: DollarSign,
  delinquency_alert: AlertTriangle,
  claim_update: FileText,
  system: Settings,
};

const TYPE_STYLES: Record<string, string> = {
  payment_reminder: "bg-terminal-amber/10 text-terminal-amber",
  delinquency_alert: "bg-terminal-red/10 text-terminal-red",
  claim_update: "bg-blue-50 text-blue-600",
  system: "bg-muted text-muted-foreground",
};

export default function Notifications() {
  const notifications = useQuery(api.notifications.listForUser);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const generateReminders = useMutation(api.notifications.generateReminders);

  const unreadCount = notifications?.filter(
    (n) => n.status === "pending" || n.status === "sent"
  ).length ?? 0;

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded bg-terminal-amber/10 flex items-center justify-center relative">
            <Bell className="h-4.5 w-4.5 text-terminal-amber" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-terminal-red text-white text-[9px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-xs text-muted-foreground">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={() => generateReminders()}
          >
            <BellRing className="h-3.5 w-3.5" /> Generate Reminders
          </Button>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={() => markAllRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {notifications?.map((n) => {
          const isUnread = n.status === "pending" || n.status === "sent";
          const Icon = TYPE_ICONS[n.type] || Bell;
          const iconStyle = TYPE_STYLES[n.type] || "bg-muted text-muted-foreground";

          return (
            <Card
              key={n._id}
              className={`transition-colors ${isUnread ? "border-terminal-amber/30 bg-terminal-amber/[0.02]" : "opacity-60"}`}
            >
              <CardContent className="p-3 flex items-start gap-3">
                <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${iconStyle}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-terminal-amber shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {isUnread && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => markRead({ notificationId: n._id })}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {notifications?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs mt-1">Click "Generate Reminders" to check for overdue payments</p>
          </div>
        )}
      </div>
    </div>
  );
}
