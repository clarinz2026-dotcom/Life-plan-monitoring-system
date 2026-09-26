import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageLoading } from "@/components/PageLoading";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Palette,
  Shield,
  Upload,
  Link2,
  Trash2,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const MAX_SIZE_MB = 2;

export default function Branding() {
  const roleData = useQuery(api.users.hasRole);
  const settings = useQuery(api.settings.get);

  const setLogoFromUrl = useMutation(api.settings.setLogoFromUrl);
  const generateUploadUrl = useMutation(api.settings.generateUploadUrl);
  const setLogoFromUpload = useMutation(api.settings.setLogoFromUpload);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = roleData?.role === "super_admin" || roleData?.role === "ceo";
  const isViewerSuperAdmin = roleData?.role === "super_admin";

  const handleFilePick = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please choose a PNG, JPG, WebP, GIF, or SVG image.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image is too large — keep it under ${MAX_SIZE_MB}MB.`);
      return;
    }
    setSelectedFile(file);
    setUrlInput("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }, [previewUrl]);

  const resetPicks = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setUrlInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl]);

  const handleSaveUploaded = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });
      if (!result.ok) throw new Error("Upload failed — please try again.");
      const { storageId } = (await result.json()) as { storageId: string };
      await setLogoFromUpload({ storageId: storageId as any });
      toast.success("Logo updated — it now shows everywhere in the app.");
      resetPicks();
    } catch (error: any) {
      toast.error(error?.message || "Could not save the logo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUrl = async () => {
    const url = urlInput.trim();
    if (!url) {
      toast.error("Paste an image URL first.");
      return;
    }
    setIsSaving(true);
    try {
      await setLogoFromUrl({ url });
      toast.success("Logo updated — it now shows everywhere in the app.");
      resetPicks();
    } catch (error: any) {
      toast.error(error?.message || "Could not save that URL.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await setLogoFromUrl({ url: "" });
      toast.success("Logo reset to the default.");
      resetPicks();
    } catch (error: any) {
      toast.error(error?.message || "Could not reset the logo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!roleData) {
    return <PageLoading label="Loading branding" className="min-h-[320px]" />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          Only the Super Admin or CEO can change the app logo.
        </p>
      </div>
    );
  }

  // What is shown as "current" — custom logo, pending pick, or the default.
  const currentLogo = previewUrl || (settings?.logoUrl ? settings.logoUrl : "/logo.svg");
  const hasCustomLogo = Boolean(settings?.logoUrl);

  return (
    <div className="p-5 md:p-8 space-y-4 md:space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-terminal-green/10 flex items-center justify-center">
          <Palette className="h-5 w-5 text-terminal-green" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branding</h1>
          <p className="text-xs text-muted-foreground">
            Change the app logo anytime — it updates everywhere instantly.
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center gap-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Current Logo
        </p>
        <div className="h-24 w-24 rounded-xl border border-border bg-background flex items-center justify-center p-3 overflow-hidden">
          <img
            src={currentLogo}
            alt="Logo preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {previewUrl
            ? "Preview of the image you selected — save it below to apply."
            : hasCustomLogo
              ? "This is your custom logo (sidebar, mobile header, sign-in, landing, tab icon)."
              : "Using the default logo."}
        </p>
      </div>

      {/* Where it appears */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-terminal-green" />
        <p>
          The logo shows in the sidebar, mobile top bar, landing page, and sign-in
          page, and is also used as the browser tab icon. Saved instantly — no
          refresh needed.
        </p>
      </div>

      {/* Upload / replace */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <Label className="text-xs">Upload an image</Label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={(e) => handleFilePick(e.target.files?.[0])}
              className="text-sm max-w-sm"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            PNG, JPG, WebP, GIF, or SVG · max {MAX_SIZE_MB}MB
          </p>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-terminal-green" />
            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
          </div>
        )}

        <div>
          <Label className="text-xs">…or paste an image URL</Label>
          <Input
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (e.target.value && selectedFile) {
                setSelectedFile(null);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }
            }}
            placeholder="https://your-site.com/logo.png"
            className="text-sm mt-2"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSaveUploaded}
            disabled={!selectedFile || isSaving}
            className="gap-2"
          >
            {isSaving && selectedFile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Save Image
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveUrl}
            disabled={!urlInput.trim() || isSaving}
            className="gap-2"
          >
            {isSaving && !selectedFile && urlInput.trim() ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Use This URL
          </Button>
          {(selectedFile || previewUrl || urlInput) && (
            <Button variant="ghost" onClick={resetPicks} className="gap-2 text-muted-foreground">
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Danger zone */}
      {hasCustomLogo && (
        <div className="rounded-lg border border-destructive/30 bg-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Reset to default logo</p>
            <p className="text-xs text-muted-foreground">
              Removes the custom logo and goes back to the bundled one.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRemove} disabled={isSaving} className="text-destructive gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove Logo
          </Button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        {isViewerSuperAdmin
          ? "Managed by the Super Admin."
          : "Logo changes are available to the CEO and Super Admin."}
      </p>
    </div>
  );
}
