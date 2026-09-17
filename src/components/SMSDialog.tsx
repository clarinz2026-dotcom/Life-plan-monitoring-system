import { useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Info, MessageSquare, Send, XCircle } from "lucide-react";

export interface SmsRecipient {
  phone: string;
  name: string;
  recipientType: "client" | "staff";
  clientId?: string;
  staffUserId?: string;
}

interface SendResult {
  to: string;
  name: string;
  status: "sent" | "failed";
  error?: string;
}

/** Mirror of the backend's PH number normalizer, for client-side warnings. */
function normalizePH(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  const n = digits.startsWith("+") ? digits.slice(1) : digits;
  if (n.startsWith("639")) return `+${n}`;
  if (n.startsWith("09") && n.length === 11) return `+63${n.slice(1)}`;
  if (n.startsWith("9") && n.length === 10) return `+63${n}`;
  if (digits.startsWith("+") && n.length >= 10 && n.length <= 15) return `+${n}`;
  return null;
}

const MAX_RECIPIENTS = 100;

/**
 * Compose and send one message to many recipients.
 *
 * Shared by the Clients page ("Send SMS" on the selection bar, recipients =
 * clients) and the staff/roles page (recipients = staff accounts). The dialog
 * reports per-recipient outcomes because Twilio rejects numbers individually —
 * a batch is not all-or-nothing.
 */
export function SMSDialog({
  open,
  onOpenChange,
  recipients,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: SmsRecipient[];
  title: string;
}) {
  const sendBulk = useAction(api.sms.sendBulk);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);

  const valid = useMemo(
    () => recipients.filter((r) => normalizePH(r.phone) !== null),
    [recipients],
  );
  const invalid = useMemo(
    () => recipients.filter((r) => normalizePH(r.phone) === null),
    [recipients],
  );
  const sendable = valid.slice(0, MAX_RECIPIENTS);
  const segments = Math.max(1, Math.ceil(message.length / 160));

  const handleSend = async () => {
    if (!message.trim() || sendable.length === 0) return;
    setSending(true);
    setResults(null);
    try {
      const res = await sendBulk({
        recipients: sendable.map((r) => ({
          phone: r.phone,
          name: r.name,
          recipientType: r.recipientType,
          clientId: r.clientId as never,
          staffUserId: r.staffUserId as never,
        })),
        message,
      });
      setResults(res.results);
    } catch (e) {
      setResults([
        {
          to: "",
          name: "",
          status: "failed",
          error: e instanceof Error ? e.message : "Failed to send",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) onOpenChange(next); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <MessageSquare className="h-5 w-5 text-evergreen" />
            {title}
          </DialogTitle>
          <DialogDescription>
            One message, sent individually to each recipient. Replies go to your Twilio number, not the app.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Send results</p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 border-b border-border/40 px-3 py-2 last:border-0">
                  {r.status === "sent" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.name || r.to}</p>
                    {r.error && <p className="text-xs text-red-700">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setResults(null); setMessage(""); }}>Send another</Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[14px]">Recipients ({sendable.length})</Label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {sendable.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs border border-border">
                      {r.name}
                      <span className="text-muted-foreground">{r.phone}</span>
                    </span>
                  ))}
                </div>
              </div>
              {invalid.length > 0 && (
                <Alert className="border-amber-300 bg-amber-50">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-xs">
                    {invalid.length} recipient{invalid.length !== 1 ? "s" : ""} without a usable mobile number will be skipped: {invalid.slice(0, 3).map((r) => r.name).join(", ")}{invalid.length > 3 ? "…" : ""}
                  </AlertDescription>
                </Alert>
              )}
              {valid.length > MAX_RECIPIENTS && (
                <Alert className="border-red-300 bg-red-50">
                  <Info className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 text-xs">
                    Up to {MAX_RECIPIENTS} recipients per send — only the first {MAX_RECIPIENTS} of your {valid.length} will receive this message.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sms-message" className="text-[14px]">Message</Label>
              <Textarea
                id="sms-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Good day! This is Evangelist Funeral Services. Your monthly payment is due. Thank you."
                rows={5}
                maxLength={800}
                className="text-[15px]"
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/800 characters · {segments} SMS segment{segments !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
              <Button
                onClick={handleSend}
                disabled={sending || !message.trim() || sendable.length === 0}
                className="gap-2"
              >
                {sending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending to {sendable.length}…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send to {sendable.length} recipient{sendable.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
