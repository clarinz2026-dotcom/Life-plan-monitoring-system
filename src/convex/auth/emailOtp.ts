import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Email one-time-password sign-in.
 *
 * The code is generated and verified by Convex Auth; this file only decides how
 * the message gets to the planholder. Delivery is Resend, called from a Convex
 * action-capable runtime so the API key never reaches the browser.
 *
 * ── Credentials (set these as Convex environment variables) ───────────────
 *   RESEND_API_KEY      Resend API key ("re_…")
 *   RESEND_FROM_EMAIL   Verified sender, e.g. "Evangelist Funeral Services
 *                       <no-reply@yourdomain.com>"
 *
 * The sender must be on a domain you have verified in Resend — an address at an
 * unverified domain will be rejected.
 */
export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet: string = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      // Fail loudly: a silently undelivered code looks to the user like a wrong
      // email address, and they will retry forever.
      throw new Error(
        "RESEND_API_KEY and RESEND_FROM_EMAIL must be set to send sign-in codes."
      );
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Your Evangelist Funeral Services sign-in code",
      text: `Your sign-in code is ${token}\n\nIt expires in 15 minutes. If you did not request this code, you can ignore this message.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px">
  <p style="margin:0 0 16px;font-size:15px;color:#211f1a">Your sign-in code for Evangelist Funeral Services is:</p>
  <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:6px;color:#1b4332">${token}</p>
  <p style="margin:0;font-size:13px;color:#716c60">It expires in 15 minutes. If you did not request this code, you can ignore this message.</p>
</div>`,
    });

    if (error) {
      throw new Error(`Could not send the sign-in code: ${error.message}`);
    }
  },
});
