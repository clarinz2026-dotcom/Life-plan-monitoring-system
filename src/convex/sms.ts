"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isAdminRole } from "./access";

/**
 * Outbound SMS via Twilio's REST API.
 *
 * A plain `fetch` to https://api.twilio.com/2010-04-01/... rather than the
 * twilio npm package: one POST per recipient with HTTP Basic auth is the
 * entire integration, and it avoids pulling the SDK (and its transitive
 * dependencies) into the bundle.
 *
 * Required keys (Keys / API keys tab — set all three):
 *   TWILIO_ACCOUNT_SID   e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER  your Twilio sender number, E.164 (e.g. +1…, or a PH number)
 */

/** Normalize a PH mobile number to E.164 (+639…). */
export function normalizePHNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let n = digits.startsWith("+") ? digits.slice(1) : digits;

  if (n.startsWith("639")) return `+${n}`; // already country-coded
  if (n.startsWith("9") && n.length === 10) return `+63${n}`; // 9XXXXXXXXX
  if (n.startsWith("09") && n.length === 11) return `+63${n.slice(1)}`; // 09XXXXXXXXX
  if (n.length === 10 && n.startsWith("9")) return `+63${n}`;

  // Non-PH formats (e.g. +1… for a Twilio trial sender in the US): pass
  // through anything that already carries a country code and a plausible length.
  if (digits.startsWith("+") && n.length >= 10 && n.length <= 15) {
    return `+${n}`;
  }
  return null;
}

/** The app's messages must never blow past a carrier's segment limits silently. */
function smsSegments(body: string): number {
  return Math.max(1, Math.ceil(body.length / 160));
}

interface SendResult {
  to: string;
  name: string;
  status: "sent" | "failed";
  sid?: string;
  error?: string;
}

export const sendBulk = action({
  args: {
    recipients: v.array(
      v.object({
        phone: v.string(),
        name: v.optional(v.string()),
        recipientType: v.union(v.literal("client"), v.literal("staff")),
        clientId: v.optional(v.id("clients")),
        staffUserId: v.optional(v.id("users")),
      })
    ),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ results: SendResult[] }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Actions have no ctx.db, so read the user directly for the role check.
    const user = await ctx.auth.getUserIdentity();
    void user;
    const userDoc = await ctx.runQuery(api.smsLog.viewerRole, {});
    if (!userDoc) throw new Error("Not authenticated");
    if (!isAdminRole(userDoc.role) && userDoc.role !== "manager" && userDoc.role !== "cashier" && userDoc.role !== "finance_staff") {
      throw new Error("You do not have permission to send SMS.");
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        "SMS is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER in the Keys tab."
      );
    }

    const message = args.message.trim();
    if (!message) throw new Error("The message is empty.");
    if (message.length > 800) {
      throw new Error("The message is too long (max 800 characters).");
    }

    // Dedupe identical phone numbers — one text per family, not per record.
    const seen = new Set<string>();
    const recipients = args.recipients.filter((r) => {
      const key = r.phone.replace(/[^\d]/g, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (recipients.length > 100) {
      throw new Error(`You can send up to 100 SMS at a time — ${recipients.length} were selected. Split the list and try again.`);
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const results: SendResult[] = [];

    for (const recipient of recipients) {
      const to = normalizePHNumber(recipient.phone);
      const label = recipient.name || to || recipient.phone;
      if (!to) {
        results.push({ to: recipient.phone, name: label, status: "failed", error: "Invalid phone number" });
        await ctx.runMutation(api.smsLog.log, {
          to: recipient.phone,
          recipientName: recipient.name,
          recipientType: recipient.recipientType,
          clientId: recipient.clientId,
          staffUserId: recipient.staffUserId,
          body: message,
          status: "failed",
          errorMessage: "Invalid phone number",
        });
        continue;
      }

      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Body: message,
          }),
        });

        const data = (await res.json()) as { sid?: string; message?: string; code?: number };
        if (!res.ok) {
          const err = data.message || `Twilio error ${res.status}${data.code ? ` (code ${data.code})` : ""}`;
          results.push({ to, name: label, status: "failed", error: err });
          await ctx.runMutation(api.smsLog.log, {
            to,
            recipientName: recipient.name,
            recipientType: recipient.recipientType,
            clientId: recipient.clientId,
            staffUserId: recipient.staffUserId,
            body: message,
            status: "failed",
            errorMessage: err,
          });
        } else {
          results.push({ to, name: label, status: "sent", sid: data.sid });
          await ctx.runMutation(api.smsLog.log, {
            to,
            recipientName: recipient.name,
            recipientType: recipient.recipientType,
            clientId: recipient.clientId,
            staffUserId: recipient.staffUserId,
            body: message,
            status: "sent",
            providerSid: data.sid,
          });
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : "Network error";
        results.push({ to, name: label, status: "failed", error: err });
        await ctx.runMutation(api.smsLog.log, {
          to,
          recipientName: recipient.name,
          recipientType: recipient.recipientType,
          clientId: recipient.clientId,
          staffUserId: recipient.staffUserId,
          body: message,
          status: "failed",
          errorMessage: err,
        });
      }
    }

    return { results };
  },
});


