import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
} from "lucide-react";

export default function MyRoutePage() {
  const myRoutes = useQuery(api.collectorRoutes.myRoutes);
  const completeStop = useMutation(api.collectorRoutes.completeStop);
  const uncompleteStop = useMutation(api.collectorRoutes.uncompleteStop);

  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  if (!myRoutes) {
    return (
      <div className="p-5 md:p-8 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const handleToggleStop = async (routeClientId: string, isCompleted: boolean) => {
    if (isCompleted) {
      await uncompleteStop({ routeClientId: routeClientId as any });
    } else {
      await completeStop({ routeClientId: routeClientId as any });
    }
  };

  // Stats across all routes
  const totalStops = myRoutes.reduce((sum, r) => sum + r.clients.length, 0);
  const completedStops = myRoutes.reduce(
    (sum, r) => sum + r.clients.filter((c) => c.isCompleted).length,
    0
  );
  const totalCollected = myRoutes.reduce(
    (sum, r) =>
      sum +
      r.clients
        .filter((c) => c.isCompleted && c.lastPaymentAmount)
        .reduce((s, c) => s + (c.lastPaymentAmount || 0), 0),
    0
  );
  const totalDue = myRoutes.reduce(
    (sum, r) => sum + r.clients.reduce((s, c) => s + c.totalDue, 0),
    0
  );
  const progress = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">&gt; My Route</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your assigned collection routes and stops for today
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{completedStops}/{totalStops}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stops Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-terminal-green" />
              <div>
                <p className="text-lg font-bold text-terminal-green">
                  ₱{totalCollected.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-terminal-amber" />
              <div>
                <p className="text-lg font-bold">₱{totalDue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Due</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{myRoutes.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Routes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Overall Progress</span>
            <span className="text-xs font-bold">{progress}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-terminal-green rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Routes */}
      {myRoutes.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No routes assigned to you</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ask your manager to assign you to a collector route.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {myRoutes.map((route) => {
            const routeProgress =
              route.clients.length > 0
                ? Math.round((route.completedCount / route.clients.length) * 100)
                : 0;
            const isExpanded = expandedRoute === route._id;
            const pendingClients = route.clients.filter((c) => !c.isCompleted);
            const completedClients = route.clients.filter((c) => c.isCompleted);

            return (
              <Card key={route._id}>
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedRoute(isExpanded ? null : route._id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <CardTitle className="text-sm">{route.routeName}</CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {route.area}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold">{route.completedCount}/{route.clients.length}</p>
                        <p className="text-[10px] text-muted-foreground">{routeProgress}%</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {/* Mini progress bar */}
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-terminal-green rounded-full transition-all"
                        style={{ width: `${routeProgress}%` }}
                      />
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    {/* Pending stops first */}
                    {pendingClients.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                          &gt; Pending Stops ({pendingClients.length})
                        </h3>
                        <div className="space-y-2">
                          {pendingClients
                            .sort((a, b) => a.stopOrder - b.stopOrder)
                            .map((stop) => (
                              <StopCard
                                key={stop._id}
                                stop={stop}
                                onToggle={handleToggleStop}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Completed stops */}
                    {completedClients.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-[10px] text-terminal-green uppercase tracking-wider mb-2">
                          ✓ Completed ({completedClients.length})
                        </h3>
                        <div className="space-y-2">
                          {completedClients
                            .sort((a, b) => a.stopOrder - b.stopOrder)
                            .map((stop) => (
                              <StopCard
                                key={stop._id}
                                stop={stop}
                                onToggle={handleToggleStop}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StopCard({
  stop,
  onToggle,
}: {
  stop: any;
  onToggle: (id: string, isCompleted: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        stop.isCompleted
          ? "border-terminal-green/20 bg-terminal-green/5"
          : "border-border hover:border-muted"
      }`}
    >
      {/* Toggle button */}
      <button
        className="shrink-0 mt-0.5"
        onClick={() => onToggle(stop._id, stop.isCompleted)}
      >
        {stop.isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-terminal-green" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-terminal-green transition-colors" />
        )}
      </button>

      {/* Client info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${stop.isCompleted ? "line-through text-muted-foreground" : ""}`}>
            #{stop.stopOrder} — {stop.client?.firstName} {stop.client?.lastName}
          </span>
          {stop.hasDelinquent && (
            <Badge variant="outline" className="text-[9px] text-terminal-amber border-terminal-amber/30">
              DELINQUENT
            </Badge>
          )}
        </div>

        {/* Address */}
        {stop.client && (
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />
            {[stop.client.address, stop.client.city].filter(Boolean).join(", ") || "—"}
          </p>
        )}

        {/* Details row */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {stop.estimatedTime && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" /> {stop.estimatedTime}
            </span>
          )}
          {stop.client?.contactNumber && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Phone className="h-2.5 w-2.5" /> {stop.client.contactNumber}
            </span>
          )}
          <span className="text-[10px] flex items-center gap-0.5">
            <CreditCard className="h-2.5 w-2.5 text-terminal-amber" />
            <span className={stop.totalDue > 0 ? "text-terminal-amber" : "text-terminal-green"}>
              ₱{stop.totalDue.toLocaleString()} due
            </span>
          </span>
        </div>

        {/* Last payment info */}
        {stop.lastPaymentDate && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Last payment: {new Date(stop.lastPaymentDate).toLocaleDateString()} — ₱{(stop.lastPaymentAmount || 0).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
