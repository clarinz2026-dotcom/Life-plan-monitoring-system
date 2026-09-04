import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function RouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const route = useQuery(
    api.collectorRoutes.get,
    routeId ? { routeId: routeId as Id<"collector_routes"> } : "skip"
  );
  const navigate = useNavigate();

  if (!route) {
    return (
      <div className="p-5 md:p-8 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const completedStops = route.clients.filter((c) => c.isCompleted);
  const pendingStops = route.clients.filter((c) => !c.isCompleted);
  const totalDue = route.clients.reduce((sum, c) => sum + c.totalDue, 0);
  const delinquentCount = route.clients.filter((c) => c.hasDelinquent).length;
  const progress = route.clients.length > 0
    ? Math.round((completedStops.length / route.clients.length) * 100)
    : 0;

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mt-1"
          onClick={() => navigate("/routes")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight truncate">
            &gt; {route.routeName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {route.area}
            {route.city && ` · ${route.city}`}
            {route.province && `, ${route.province}`}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className="text-[10px]">
              {route.frequency}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Collector: {route.collectorName}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-3xl font-bold">{route.clients.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Stops</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-3xl font-bold text-terminal-green">{completedStops.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-3xl font-bold text-terminal-amber">{pendingStops.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-3xl font-bold">₱{totalDue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Due</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Route Progress</span>
            <span className="text-xs font-bold">{progress}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-terminal-green rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              {completedStops.length} of {route.clients.length} stops
            </span>
            {delinquentCount > 0 && (
              <span className="text-[10px] text-terminal-amber flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" />
                {delinquentCount} delinquent
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stops list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          &gt; Route Stops
        </h2>
        <div className="space-y-2">
          {[...route.clients]
            .sort((a, b) => a.stopOrder - b.stopOrder)
            .map((stop, idx) => (
              <Card
                key={stop._id}
                className={`transition-colors ${
                  stop.isCompleted
                    ? "border-terminal-green/30 bg-terminal-green/5"
                    : "hover:border-muted"
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Stop number + status icon */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground w-5 text-right">
                        #{stop.stopOrder}
                      </span>
                      {stop.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-terminal-green" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Client info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {stop.client?.firstName} {stop.client?.lastName}
                        </span>
                        {stop.hasDelinquent && (
                          <Badge variant="outline" className="text-[9px] text-terminal-amber border-terminal-amber/30 shrink-0">
                            DELINQUENT
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {stop.estimatedTime && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {stop.estimatedTime}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          ₱{stop.totalDue.toLocaleString()} due
                        </span>
                        {stop.contractCount > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <FileText className="h-2.5 w-2.5" /> {stop.contractCount} contract(s)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px]"
                        onClick={() => navigate(`/clients/${stop.clientId}`)}
                      >
                        View
                      </Button>
                    </div>
                  </div>

                  {/* Address */}
                  {stop.client && (
                    <p className="text-[10px] text-muted-foreground mt-1 ml-9">
                      {[stop.client.address, stop.client.city, stop.client.province]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>

        {route.clients.length === 0 && (
          <div className="text-center py-8">
            <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No stops on this route</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add clients manually or use auto-assign from the routes page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
