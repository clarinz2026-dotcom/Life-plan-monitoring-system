import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InlineLoading } from "@/components/PageLoading";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Crown, ArrowRight, Loader2, CheckCircle, Mail, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export default function SuperAdminSetup() {
  const hasSuperAdmin = useQuery(api.users.hasSuperAdmin);
  const roleData = useQuery(api.users.hasRole);
  const claimSuperAdmin = useMutation(api.users.claimSuperAdmin);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [wrongEmail, setWrongEmail] = useState(false);

  // Already has super admin role — this is the real owner
  if ((roleData?.role as string) === "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <div className="h-16 w-16 rounded-2xl bg-purple-100 flex items-center justify-center">
          <Crown className="h-8 w-8 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold">You are the Super Admin</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          You have full system access. Go to Role Management to assign roles to other users.
        </p>
        <Button onClick={() => navigate("/role-management")} className="gap-2 mt-2">
          Go to Role Management
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Loading
  if (!hasSuperAdmin || !roleData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        <InlineLoading label="Loading" className="py-0" />
      </div>
    );
  }

  // Super admin email is already locked — show "wrong email" if this user is different
  if (hasSuperAdmin.hasSuperAdmin && wrongEmail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <div className="h-16 w-16 rounded-2xl bg-terminal-red/10 flex items-center justify-center">
          <ShieldCheck className="h-8 w-8 text-terminal-red" />
        </div>
        <h2 className="text-xl font-bold">Wrong Account</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          This system already has a Super Admin locked to a different email. Only that email can hold the Super Admin role.
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-sm bg-muted rounded-lg p-3 font-mono">
          Locked email: {hasSuperAdmin.superAdminEmail}
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Sign in with the correct email, or contact your Super Admin to assign you a different role.
        </p>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" onClick={async () => { await signOut(); navigate("/"); }} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Super admin email is locked — but same email person is re-logging in
  // This case is handled by claimSuperAdmin mutation (re-assigns role)
  if (hasSuperAdmin.hasSuperAdmin && (roleData?.role as string) !== "super_admin") {
    // Same email as locked — try to re-claim
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <div className="h-16 w-16 rounded-2xl bg-terminal-amber/15 flex items-center justify-center">
          <Crown className="h-8 w-8 text-terminal-amber" />
        </div>
        <h2 className="text-xl font-bold">Restore Super Admin</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Your Super Admin role was removed. Click below to restore it.
        </p>
        <Button
          onClick={async () => {
            setLoading(true);
            try {
              await claimSuperAdmin();
              setClaimed(true);
              toast.success("Super Admin role restored!");
            } catch (error: any) {
              // If the error is about wrong email, show the wrong email screen
              if (error.message.includes("already has a Super Admin")) {
                setWrongEmail(true);
              } else {
                toast.error(error.message || "Failed to restore role");
              }
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="gap-2 mt-2"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Restoring...
            </>
          ) : (
            <>
              <Crown className="h-4 w-4" />
              Restore My Super Admin Role
            </>
          )}
        </Button>
      </div>
    );
  }

  // Success screen
  if (claimed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <div className="h-16 w-16 rounded-2xl bg-terminal-green/10 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-terminal-green" />
        </div>
        <h2 className="text-xl font-bold">Super Admin Activated!</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Your email is now permanently locked as the Super Admin. No one else can ever take this role.
        </p>
        <div className="bg-muted rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Locked to</p>
          <p className="text-xs font-mono font-medium">{hasSuperAdmin.superAdminEmail || "your email"}</p>
        </div>
        <Button onClick={() => navigate("/role-management")} className="gap-2 mt-2">
          Set Up Team Roles
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // First-time claim screen — no super admin exists yet
  const handleClaim = async () => {
    setLoading(true);
    try {
      const result = await claimSuperAdmin();
      setClaimed(true);
      if (result.locked) {
        toast.success("Super Admin claimed! Your email is permanently locked.");
      } else {
        toast.success("Super Admin role restored!");
      }
    } catch (error: any) {
      if (error.message.includes("already has a Super Admin")) {
        setWrongEmail(true);
      } else {
        toast.error(error.message || "Failed to claim Super Admin role");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-4">
      <div className="text-center space-y-2">
        <div className="h-20 w-20 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto">
          <Crown className="h-10 w-10 text-purple-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Super Admin Setup</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          This is the first time the app is being set up. You can claim the <strong>Super Admin</strong> role —
          only <strong>one person</strong> can be Super Admin, and it&apos;s <strong>permanently locked to your email</strong>.
        </p>
      </div>

      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center mt-0.5">
              <Crown className="h-3 w-3 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Full System Control</p>
              <p className="text-xs text-muted-foreground">
                Access all pages, data, and settings
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded bg-blue-100 flex items-center justify-center mt-0.5">
              <ShieldCheck className="h-3 w-3 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Manage All Users</p>
              <p className="text-xs text-muted-foreground">
                Assign and change roles for every user
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded bg-terminal-red/10 flex items-center justify-center mt-0.5">
              <Mail className="h-3 w-3 text-terminal-red" />
            </div>
            <div>
              <p className="text-sm font-medium">Permanently Locked to Your Email</p>
              <p className="text-xs text-muted-foreground">
                No one else can ever become Super Admin — even if your role is removed, only you can restore it
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleClaim}
          disabled={loading}
          className="w-full gap-2"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <Crown className="h-4 w-4" />
              Claim Super Admin Role
            </>
          )}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          Your role will be permanently tied to this email account
        </p>
      </div>
    </div>
  );
}
