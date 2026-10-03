# Third-party services & asset licences

Audit note for the Evangelist Funeral Services application. Reviewed **3 October 2026**.

This is the working note behind the public pages. The list a planholder reads is
generated from `src/lib/legal.ts` (`THIRD_PARTY_SERVICES`) so it cannot drift
from the code; this file adds the evidence and the reasoning.

---

## 1. Services that receive planholder data

| Service | Reached from | What it receives | Why we use it | Where its terms live |
|---|---|---|---|---|
| **Convex** | the whole app (queries, mutations, file storage) | every planholder record: name, date of birth, contact details, address, plan, payments, receipts | database, live updates, and auth session storage | https://www.convex.dev/privacy |
| **Convex Auth** | `src/convex/auth.ts` | email address, and whether the one-time code was correct | passwordless sign-in for staff and planholders | https://convex.dev |
| **Freebuff email relay** | `src/convex/auth/emailOtp.ts` → `POST auth.freebuff.app/send_otp` | email address + the six-digit code, for the length of one request | delivers the sign-in code; we never see the rest of the email | https://freebuff.com |
| **Twilio** | `src/convex/sms.ts` → `POST api.twilio.com/2010-04-01/…` | name + mobile number, for messages staff send | collection reminders and branch notices | https://www.twilio.com/legal/privacy |
| **Airtable** | `src/convex/airtable.ts` → `POST api.airtable.com/v0` | full planholder record, contracts, payments, receipts | **optional** export into an Airtable base the office connects, for its own views and dashboards | https://airtable.com/privacy |

Notes:

- Airtable is off until the office supplies `AIRTABLE_TOKEN` and
  `AIRTABLE_BASE_ID` in the project's Keys tab; with no token configured the
  sync does nothing. The push is branch-scoped (a branch user can only push its
  own branch) and blank fields are omitted rather than sent as nulls. Deleting
  a record here does not delete the Airtable row — deliberately, so an
  accidental delete cannot wipe a shared sheet. If your office does not use
  this integration, no data has ever left the database.
- The Twilio call is a plain `fetch` with HTTP Basic auth, not the Twilio npm
  SDK, so there is one fewer vendor library in the bundle and no extra
  transmission of data than the SMS itself.
- The email relay is third-party and its message template is **not** under our
  control, which is why the sign-in code email cannot carry our own unsubscribe
  footer. That is a real limitation, and the honest answer for a planholder is
  the "stop non-essential messages" request path (see §4), not a promise that
  we control that template.

## 2. Services that receive no planholder data

| Service | Used for | Consequence |
|---|---|---|
| **Unsplash** (`images.unsplash.com`) | photographs on the public pages | sees an IP address and browser details in order to serve an image; sets no cookie; no planholder data involved |
| **jsPDF** + **html2canvas** | Statement of Account → PDF | runs entirely in the browser; the statement never leaves the device |
| **SheetJS (`xlsx`)** + **Papa Parse** | bulk-upload parsing | parses the chosen file locally before anything is saved |
| **date-fns, lucide-react, framer-motion, recharts, Radix UI, clsx, tailwind-merge** | dates, icons, animation, charts, UI primitives, build-time styling | local libraries; nothing transmitted |

`@vly-ai/integrations` and `vly-toolbar-readonly.tsx` are the host platform's own
integration shim and read-only toolbar; they are not connected to planholder
data by this application.

## 3. Checked and deliberately **not** added

The audit came back wanting a short list of absences, because each one is a
decision rather than an oversight:

- **No analytics** (Google Analytics, Plausible, Mixpanel, Hotjar, FullStory…).
  There is no page-view data leaving the app, so there is no session recording
  of a grieving family reading a statement.
- **No advertising or retargeting** pixels.
- **No third-party tag manager**, which would let a tag be added without a code
  change.
- **No session-replay / heat-map** tool.
- **No CDN-hosted third-party JavaScript** on the pages that show planholder
  data. The only external asset request is the image host on the public pages.
- **No font loaded from a third party.** The one display face is served from
  this origin; everything else uses system fonts.

If any of these is ever added, it must be added to `THIRD_PARTY_SERVICES`, named
in the Privacy Policy, and reflected in the Cookie Policy — and if it is not
essential, the cookie notice has to become a real opt-in first.

---

## 4. Licences for fonts and images

| Asset | File / source | Position |
|---|---|---|
| Brayles display typeface | `public/fonts/Brayles.ttf`, used for the wordmark only | included with this application under the terms of the licence the company obtained it on. It is **not** redistributed from this repository as a general-purpose font; if you need the file itself, ask at the main office. |
| Company logo | `public/logo.svg`, managed by the Branding page | owned by Evangelist Funeral Services, Inc. Used on the site, in the app, and on printed statements. |
| Arial | system font stack | used under the terms of the operating system's / vendor's font licence. Not embedded or redistributed. |
| Times New Roman / Georgia / serif fallbacks | system font stack | as above. |
| Photographs | `images.unsplash.com`, referenced in `src/pages/Landing.tsx` | served under the Unsplash Licence, which permits commercial use without further permission. Individual photographers are credited in the image metadata. |

The user-facing statement of the above lives in the Terms of Service under
"Fonts, images, and other material".

---

## 5. Cookie / local-storage inventory

Five entries, all listed in `STORAGE_INVENTORY` and rendered on the Cookie
Policy page and in the cookie notice: the Convex Auth session, Convex client
credentials, the `theme` preference, the `evangelist:route-reload` guard, and
the record that the cookie notice itself was seen. All five are removable and
none is a tracker.

## 6. Re-running this audit

1. `bun pm ls --all` and read `package.json` — every dependency either appears
   above, is a devDependency, or is unused and should be removed.
2. `grep -rn "https://" src/` — every outbound host the app calls directly.
3. `grep -rn "<script\|<iframe" src/` — nothing third-party may be embedded.
4. Update the "Last updated" date on the Privacy and Cookie policies when this
   file changes.