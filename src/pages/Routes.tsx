import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Users, Truck, Trash2, UserPlus, Zap, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import { Id } from "@/convex/_generated/dataModel";

export default function RoutesPage() {
  const routes = useQuery(api.collectorRoutes.list);
  const allClients = useQuery(api.clients.list, {});
  const createRoute = useMutation(api.collectorRoutes.create);
  const deleteRoute = useMutation(api.collectorRoutes.remove);
  const addClientToRoute = useMutation(api.collectorRoutes.addClient);
  const autoAssign = useMutation(api.collectorRoutes.autoAssign);
  const navigate = useNavigate();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddClientDialog, setShowAddClientDialog] = useState<string | null>(null);

  const [routeName, setRouteName] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [notes, setNotes] = useState("");
  const [collectorId, setCollectorId] = useState<string>("");

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [stopOrder, setStopOrder] = useState(1);
  const [estimatedTime, setEstimatedTime] = useState("");

  if (!routes || !allClients) {
    return (
      <div className="p-5 md:p-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  const handleCreateRoute = async () => {
    if (!routeName || !area) return;
    await createRoute({
      routeName, area,
      city: city || undefined, province: province || undefined,
      assignedCollector: collectorId ? (collectorId as Id<"users">) : undefined,
      frequency, notes: notes || undefined,
    });
    setShowCreateDialog(false);
    setRouteName(""); setArea(""); setCity(""); setProvince(""); setFrequency("daily"); setNotes(""); setCollectorId("");
  };

  const handleAddClient = async (routeId: string) => {
    if (!selectedClientId) return;
    await addClientToRoute({
      routeId: routeId as Id<"collector_routes">,
      clientId: selectedClientId as Id<"clients">,
      stopOrder, estimatedTime: estimatedTime || undefined,
    });
    setShowAddClientDialog(null); setSelectedClientId(""); setStopOrder(1); setEstimatedTime("");
  };

  const handleAutoAssign = async (routeId: string) => {
    const result = await autoAssign({ routeId: routeId as Id<"collector_routes"> });
    alert(`Auto-assigned ${result.added} client(s) to this route.`);
  };

  const handleDelete = async (routeId: string) => {
    if (confirm("Delete this route and all its assignments?")) {
      await deleteRoute({ routeId: routeId as Id<"collector_routes"> });
    }
  };

  const activeRoutes = routes.filter((r) => r.isActive);
  const inactiveRoutes = routes.filter((r) => !r.isActive);

  return (
    <div className="p-5 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Collector Routes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage field collector assignments and stop routing
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-11 px-5 text-[15px]">
              <Plus className="h-5 w-5" /> New Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md mx-2 sm:mx-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create Route</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-[14px]">Route Name *</Label>
                <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Manila East Morning Run" className="text-base h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px]">Area *</Label>
                <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Manila East" className="text-base h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[14px]">City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Auto-assign filter" className="text-base h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[14px]">Province</Label>
                  <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Auto-assign filter" className="text-base h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px]">Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as "daily" | "weekly" | "monthly")}>
                  <SelectTrigger className="text-base h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px]">Assigned Collector</Label>
                <Select value={collectorId} onValueChange={setCollectorId}>
                  <SelectTrigger className="text-base h-11"><SelectValue placeholder="Select collector..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Unassigned)</SelectItem>
                    <SelectItem value="ceo">CEO</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="finance_staff">Finance Staff</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px]">Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className="text-base h-11" />
              </div>
              <Button className="w-full h-11 text-[15px]" onClick={handleCreateRoute} disabled={!routeName || !area}>
                Create Route
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Routes", value: routes.length, icon: Truck },
          { label: "Active Routes", value: activeRoutes.length, icon: MapPin },
          { label: "Assigned Collectors", value: new Set(routes.filter((r) => r.assignedCollector).map((r) => r.assignedCollector)).size, icon: Users },
          { label: "Total Stops", value: routes.reduce((sum, r) => sum + r.clientCount, 0), icon: MapPin },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[12px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-[15px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Active Routes ({activeRoutes.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeRoutes.map((route) => (
            <Card key={route._id} className="shadow-sm hover:border-green-600/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-[15px] font-semibold truncate">{route.routeName}</CardTitle>
                    <CardDescription className="text-[13px] flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5" /> {route.area}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[12px] shrink-0 ml-2">{route.frequency}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-[14px]">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Collector:</span>
                  <span className="font-medium">{route.collectorName}</span>
                </div>
                <div>
                  <div className="flex justify-between text-[13px] text-muted-foreground mb-1">
                    <span>{route.completedCount}/{route.clientCount} stops completed</span>
                    <span>{route.clientCount > 0 ? Math.round((route.completedCount / route.clientCount) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${route.clientCount > 0 ? (route.completedCount / route.clientCount) * 100 : 0}%` }} />
                  </div>
                </div>
                {(route.city || route.province) && (
                  <p className="text-[13px] text-muted-foreground">
                    {route.city && `City: ${route.city}`}{route.city && route.province && " · "}{route.province && `Province: ${route.province}`}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 text-[13px] gap-1 h-9" onClick={() => navigate(`/routes/${route._id}`)}>
                    View <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-[13px] gap-1 h-9" onClick={() => setShowAddClientDialog(route._id)}>
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-[13px] gap-1 h-9 text-amber-600" onClick={() => handleAutoAssign(route._id)}>
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[13px] text-destructive h-9" onClick={() => handleDelete(route._id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {inactiveRoutes.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Inactive Routes ({inactiveRoutes.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveRoutes.map((route) => (
              <Card key={route._id} className="opacity-60 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-[15px] font-semibold truncate">{route.routeName}</CardTitle>
                      <CardDescription className="text-[13px] flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" /> {route.area}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[12px] shrink-0 ml-2">inactive</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="text-[13px] text-destructive" onClick={() => handleDelete(route._id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {routes.length === 0 && (
        <div className="text-center py-14">
          <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-base text-muted-foreground">No routes yet</p>
          <p className="text-[13px] text-muted-foreground mt-1">Create a route to start assigning collectors to client stops.</p>
        </div>
      )}

      <Dialog open={showAddClientDialog !== null} onOpenChange={(open) => { if (!open) setShowAddClientDialog(null); }}>
        <DialogContent className="max-w-md mx-2 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add Client to Route</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-[14px]">Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="text-base h-11"><SelectValue placeholder="Select a client..." /></SelectTrigger>
                <SelectContent>
                  {allClients.map((client) => (
                    <SelectItem key={client._id} value={client._id}>{client.firstName} {client.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[14px]">Stop Order</Label>
                <Input type="number" value={stopOrder} onChange={(e) => setStopOrder(parseInt(e.target.value) || 1)} className="text-base h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px]">Est. Time</Label>
                <Input value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="9:00 AM" className="text-base h-11" />
              </div>
            </div>
            <Button className="w-full h-11 text-[15px]" onClick={() => showAddClientDialog && handleAddClient(showAddClientDialog)} disabled={!selectedClientId}>
              Add to Route
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
