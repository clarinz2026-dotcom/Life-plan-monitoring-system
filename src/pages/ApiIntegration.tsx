import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageLoading } from "@/components/PageLoading";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Plus,
  Trash2,
  Ban,
  Copy,
  CheckCircle2,
  Shield,
  ShieldOff,
  Info,
  Activity,
  Loader2,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import {
  API_KEY_SCOPES,
  API_SCOPE_DESCRIPTIONS,
  API_SCOPE_LABELS,
  maskKey,
  type ApiKeyScope,
} from "@/lib/apiKeys";

/** Staff-portal base URL for the docs snippets (deployment URL = API host). */
function apiBaseUrl(): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) return "https://<your-deployment>.convex.site";
  return convexUrl.replace(/\.cloud$/, ".site").replace(/wss:/, "https:");
}

function fmtDate(t: number | null | undefined): string {
  if (!t) return "—";
  return new Date(t).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ApiKeyRow = {
  _id: Id<"api_keys">;
  name: string;
  scopes: string[];
  keyLast4: string;
  expiresAt: number | null;
  revokedAt: number | null;
  requestCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  createdByName: string | null;
};

export default function ApiIntegration() {
  const roleData = useQuery(api.users.hasRole);
  const keys = useQuery(api.apiKeys.list);
  const usage = useQuery(api.apiKeys.count);

  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);
  const deleteKey = useMutation(api.apiKeys.deleteKey);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<ApiKeyScope[]>([]);
  const [newExpiry, setNewExpiry] = useState("0");
  const [isCreating, setIsCreating] = useState(false);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [createdKeyName, setCreatedKeyName] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState<ApiKeyRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const isSuperAdmin = roleData?.role === "super_admin";

  if (roleData === undefined) {
    return <PageLoading label="Checking your access…" />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <ShieldOff className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold">Super Admin only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          API keys let external tools read office data. Only the Super Admin can
          mint or revoke them. Ask the Super Admin if you need an integration
          set up.
        </p>
      </div>
    );
  }

  const openCreate = () => {
    setNewName("");
    setNewScopes([]);
    setNewExpiry("0");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (newName.trim().length < 2) {
      toast.error("Give the key a name (2–60 characters).");
      return;
    }
    if (newScopes.length === 0) {
      toast.error("Pick at least one scope — a key with no scopes reads nothing.");
      return;
    }
    setIsCreating(true);
    try {
      const res = await createKey({
        name: newName.trim(),
        scopes: newScopes,
        expiresInDays: Number(newExpiry) || 0,
      });
      setCreatedKeyName(newName.trim());
      setCreatedRawKey(res.rawKey);
      setShowCreate(false);
      toast.success("API key created. Copy it now — it is shown only once.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the key.");
    } finally {
      setIsCreating(false);
    }
  };

  const copyKey = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Key copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — select the text and copy manually.");
    }
  };

  const handleRevoke = async () => {
    if (!confirmRevoke) return;
    setIsRevoking(true);
    try {
      await revokeKey({ id: confirmRevoke._id });
      toast.success(`Key "${confirmRevoke.name}" revoked.`);
      setConfirmRevoke(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke the key.");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDelete = async (key: ApiKeyRow) => {
    try {
      await deleteKey({ id: key._id });
      toast.success(`Deleted "${key.name}" from the register.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the key.");
    }
  };

  const toggleScope = (s: ApiKeyScope) => {
    setNewScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const activeCount = usage?.active ?? 0;
  const totalCount = usage?.total ?? 0;
  const base = apiBaseUrl();

  const curlSnippet = `curl "${base}/api/v1/plans?limit=5" \\
  -H "Authorization: Bearer YOUR_KEY"`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <KeyRound className="h-7 w-7 text-evergreen" />
            API Integration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let the company website, accounting tools, or spreadsheets read
            planholder data — with keys only you can issue.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 h-11 px-5 text-[15px]">
          <Plus className="h-5 w-5" />
          Create API key
        </Button>
      </div>

      {/* Summary + explainer */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Active keys
          </p>
          <p className="mt-1 text-3xl font-bold text-evergreen">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Total issued
          </p>
          <p className="mt-1 text-3xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            Rate limit
          </p>
          <p className="mt-1 text-3xl font-bold">120<span className="text-base font-medium text-muted-foreground"> /min per key</span></p>
        </div>
      </div>

      {/* Key list */}
      <div className="rounded-xl border border-border/60 bg-white shadow-sm">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 className="text-lg font-bold">Your keys</h2>
          <p className="text-[13px] text-muted-foreground">
            A key's secret is never stored — only its fingerprint. Lost key?
            Revoke it and issue a new one.
          </p>
        </div>
        {keys === undefined ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Loading keys…
          </div>
        ) : keys.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <KeyRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-[15px] font-semibold">No API keys yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Create your first key to connect an external tool.
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Create API key
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {keys.map((k: ApiKeyRow) => {
              const isRevoked = k.revokedAt != null;
              const isExpired =
                !isRevoked && k.expiresAt != null && k.expiresAt < Date.now();
              return (
                <div key={k._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-bold">{k.name}</p>
                      {isRevoked ? (
                        <Badge variant="secondary" className="text-[11px]">Revoked</Badge>
                      ) : isExpired ? (
                        <Badge variant="secondary" className="text-[11px]">Expired</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[11px]">Active</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[12.5px] text-muted-foreground">
                      {maskKey(k.keyLast4)} · created {fmtDate(k.createdAt)}
                      {k.createdByName ? ` by ${k.createdByName}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {k.scopes.length === 0 ? (
                        <span className="text-[12px] italic text-muted-foreground">no scopes — reads nothing</span>
                      ) : (
                        k.scopes.map((s) => (
                          <span key={s} className="rounded-md bg-sage/60 px-2 py-0.5 text-[11.5px] font-semibold text-evergreen">
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      {k.requestCount.toLocaleString()} requests · last used {fmtDate(k.lastUsedAt)}
                      {k.expiresAt && !isRevoked ? ` · expires ${fmtDate(k.expiresAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isRevoked && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => setConfirmRevoke(k)}
                      >
                        <Ban className="h-4 w-4" /> Revoke
                      </Button>
                    )}
                    {isRevoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() => handleDelete(k)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Docs */}
      <div className="rounded-xl border border-border/60 bg-white shadow-sm">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Code2 className="h-5 w-5 text-evergreen" /> How to connect
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Read-only REST endpoints. Send the key on every call as a Bearer
            header.
          </p>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Base URL</p>
            <code className="mt-1 block rounded-lg bg-pine px-4 py-2.5 font-mono text-[13px] text-cream">
              {base}
            </code>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Endpoints</p>
            <div className="mt-1 overflow-hidden rounded-lg border border-border/60">
              {[
                ["GET /api/v1", "Endpoint catalogue (no key needed)"],
                ["GET /api/v1/me", "What your key can read"],
                ["GET /api/v1/planholders", "Planholders — scope: clients"],
                ["GET /api/v1/planholders/:id", "One planholder + plans — scope: clients"],
                ["GET /api/v1/plans", "Plans & balances — scope: contracts"],
                ["GET /api/v1/payments", "Payment history — scope: payments"],
              ].map(([route, desc]) => (
                <div key={route} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 px-4 py-2 last:border-b-0">
                  <code className="font-mono text-[12.5px] font-bold">{route}</code>
                  <span className="text-[12.5px] text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Query params: <code className="font-mono">limit</code> (1–500, default 100),{" "}
              <code className="font-mono">since</code> (Unix ms),{" "}
              <code className="font-mono">status</code> on plans,{" "}
              <code className="font-mono">clientId</code> on payments.
            </p>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Example</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-pine px-4 py-3 font-mono text-[12.5px] leading-relaxed text-cream">
{curlSnippet}
            </pre>
          </div>
          <div className="flex gap-2.5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <p className="text-[13px] leading-relaxed">
              Keys are secrets. Share them only with the developer of the tool
              that needs one, revoke immediately if a key leaks, and give each
              integration its own key so activity is attributable. Every key
              action is recorded in the audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-evergreen" /> Create API key
            </DialogTitle>
            <DialogDescription>
              Name the integration and pick what it may read. The raw key is
              shown once after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Company website"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label>What may this key read?</Label>
              {API_KEY_SCOPES.map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 hover:bg-accent/40"
                >
                  <Checkbox
                    checked={newScopes.includes(s)}
                    onCheckedChange={() => toggleScope(s)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[14px] font-semibold">{API_SCOPE_LABELS[s]}</span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {API_SCOPE_DESCRIPTIONS[s]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key-expiry">Expires</Label>
              <select
                id="key-expiry"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="0">Never expires</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="365">In 1 year</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating} className="gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time key reveal dialog */}
      <Dialog open={createdRawKey !== null} onOpenChange={(o) => !o && setCreatedRawKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              "{createdKeyName}" is ready
            </DialogTitle>
            <DialogDescription>
              Copy this key now. For security it is shown <strong>only this once</strong> —
              the app stores just a fingerprint and cannot recover it.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border-2 border-gold/50 bg-gold/10 p-4">
            <code className="block break-all font-mono text-[13.5px] font-bold text-ink">
              {createdRawKey}
            </code>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => createdRawKey && copyKey(createdRawKey)} className="gap-2">
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              Copy key
            </Button>
            <Button onClick={() => setCreatedRawKey(null)}>
              Done — I saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={confirmRevoke !== null} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" /> Revoke "{confirmRevoke?.name}"?
            </DialogTitle>
            <DialogDescription>
              The key stops working immediately on the next request. Any website
              or script using it will start receiving 401 errors until you issue
              a new key. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={isRevoking} className="gap-2">
              {isRevoking && <Loader2 className="h-4 w-4 animate-spin" />}
              Revoke key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
