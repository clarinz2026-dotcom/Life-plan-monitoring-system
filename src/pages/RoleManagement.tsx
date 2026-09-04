import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldCheck,
  UserCog,
  Crown,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const ALL_ROLES = [
  { value: "super_admin", label: "Super Admin", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "ceo", label: "CEO", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "manager", label: "Manager", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "finance_staff", label: "Finance Staff", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "cashier", label: "Cashier", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "collector", label: "Collector", color: "bg-sky-100 text-sky-800 border-sky-200" },
] as const;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "Full system control. Can manage all users and roles. Only one allowed.",
  ceo: "Full access to all data, reports, and operations.",
  manager: "Manages operations, routes, and team oversight.",
  finance_staff: "Handles payments, contracts, reports, and financial operations.",
  cashier: "Records payments, manages receipts, and does daily reconciliation.",
  collector: "Field agent — sees assigned routes and marks stops as visited.",
};

export default function RoleManagement() {
  const roleData = useQuery(api.users.hasRole);
  const users = useQuery(api.users.list);
  const setRole = useMutation(api.users.setRole);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ userId: string; name: string; role: string } | null>(null);

  const viewerRole = roleData?.role;
  const canManage = viewerRole === "super_admin" || viewerRole === "ceo";
  const isViewerSuperAdmin = viewerRole === "super_admin";

  // Super Admin can assign every role except "super_admin" (only one exists).
  // CEO can only assign Manager / Finance Staff / Cashier / Collector.
  const ASSIGNABLE_ROLES = ALL_ROLES.filter(
    (r) => r.value !== "super_admin" && (isViewerSuperAdmin || r.value !== "ceo"),
  );

  // Roles the current viewer is not allowed to touch.
  const isProtectedRole = (role: string | null | undefined) =>
    role === "super_admin" || (!isViewerSuperAdmin && role === "ceo");

  if (!roleData || !canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          Only the Super Admin or CEO can manage user roles.
        </p>
      </div>
    );
  }

  const handleSetRole = async (userId: string, role: string) => {
    try {
      await setRole({
        userId: userId as any,
        role: role as any,
      });
      toast.success("Role updated successfully");
      setEditingUserId(null);
      setConfirmRole(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
    }
  };

  return (
    <div className="p-5 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
          <UserCog className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
          <p className="text-xs text-muted-foreground">
            {isViewerSuperAdmin
              ? "Assign and manage all user roles."
              : "Assign team roles (Manager, Finance Staff, Cashier, Collector). CEO and Super Admin roles are managed only by the Super Admin."}
          </p>
        </div>
      </div>

      {/* Permission note */}
      <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        {isViewerSuperAdmin ? (
          <p>
            <span className="font-medium text-purple-600">Super Admin:</span> You
            can assign any role except Super Admin — the Super Admin is permanently
            locked to your email and cannot be given to another user.
          </p>
        ) : (
          <p>
            <span className="font-medium text-amber-600">CEO:</span> You can assign
            Manager, Finance Staff, Cashier, and Collector roles. Creating another
            CEO or a Super Admin is restricted to the Super Admin.
          </p>
        )}
      </div>

      {/* Role Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {ALL_ROLES.map((r) => (
          <div
            key={r.value}
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
          >
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                r.value === "super_admin"
                  ? "bg-purple-500"
                  : r.value === "ceo"
                    ? "bg-amber-500"
                    : r.value === "manager"
                      ? "bg-blue-500"
                      : r.value === "finance_staff"
                        ? "bg-emerald-500"
                        : r.value === "cashier"
                          ? "bg-orange-500"
                          : "bg-sky-500"
              }`}
            />
            <span className="text-xs font-medium">{r.label}</span>
          </div>
        ))}
      </div>

      {/* Users List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Users ({users?.length ?? 0})
        </h3>

        {(!users || users.length === 0) && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No users found.
          </p>
        )}

        {users?.map((u) => {
          const roleInfo = ALL_ROLES.find((r) => r.value === u.role);
          const isEditing = editingUserId === u._id;
          const protectedRole = isProtectedRole(u.role);

          return (
            <div
              key={u._id}
              className="flex flex-col md:flex-row md:items-center gap-3 rounded-lg border border-border bg-card p-4"
            >
              {/* User Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {u.image ? (
                  <img
                    src={u.image}
                    alt={u.name || "User"}
                    className="h-9 w-9 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border border-border">
                    <span className="text-xs font-medium text-muted-foreground">
                      {(u.name || u.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.name || "Unnamed User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email || "No email"}
                  </p>
                </div>
              </div>

              {/* Current Role Badge */}
              <Badge
                variant="outline"
                className={`w-fit text-xs ${roleInfo?.color || "bg-gray-100 text-gray-800"}`}
              >
                {u.role === "super_admin" && <Crown className="h-3 w-3 mr-1" />}
                {roleInfo?.label || "No Role"}
              </Badge>

              {/* Actions */}
              {!protectedRole && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() =>
                      setEditingUserId(isEditing ? null : u._id)
                    }
                  >
                    <UserCog className="h-3.5 w-3.5" />
                    Change Role
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${isEditing ? "rotate-180" : ""}`}
                    />
                  </Button>

                  {/* Dropdown */}
                  {isEditing && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-popover shadow-lg p-1">
                      {ASSIGNABLE_ROLES.map(
                        (r) => (
                          <button
                            key={r.value}
                            onClick={() =>
                              setConfirmRole({
                                userId: u._id,
                                name: u.name || u.email || "User",
                                role: r.label,
                              })
                            }
                            className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors ${
                              u.role === r.value
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-foreground hover:bg-accent/50"
                            }`}
                          >
                            <div
                              className={`h-2 w-2 rounded-full ${
                                r.value === "ceo"
                                  ? "bg-amber-500"
                                  : r.value === "manager"
                                    ? "bg-blue-500"
                                    : r.value === "finance_staff"
                                      ? "bg-emerald-500"
                                      : r.value === "cashier"
                                        ? "bg-orange-500"
                                        : "bg-sky-500"
                              }`}
                            />
                            {r.label}
                            {u.role === r.value && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                current
                              </span>
                            )}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {protectedRole && (
                <div
                  className={`flex items-center gap-1.5 ${
                    u.role === "super_admin" ? "text-purple-600" : "text-amber-600"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {u.role === "super_admin"
                      ? "Protected · Super Admin only"
                      : isViewerSuperAdmin
                        ? "Protected"
                        : "Protected · managed by Super Admin"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      {confirmRole && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmRole(null)}
          />
          <div className="relative bg-card border border-border rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold mb-2">Change Role</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set <strong>{confirmRole.name}</strong> as{" "}
              <strong>{confirmRole.role}</strong>?
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRole(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  handleSetRole(
                    confirmRole.userId,
                    ALL_ROLES.find((r) => r.label === confirmRole.role)
                      ?.value || confirmRole.role,
                  )
                }
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
