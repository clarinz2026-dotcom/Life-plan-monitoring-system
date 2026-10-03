/**
 * Single source of truth for everything the legal pages state.
 *
 * The privacy notice, the cookie policy, the consent checkboxes, and the
 * server-side request validator all read from here, so a promise made in the
 * policy cannot drift away from what the code actually does. Anything that
 * describes the business (name, address, contact) is also printed on the
 * Statement of Account and in the site footer — keep the two in step.
 */

/** The office as it identifies itself on every document it issues. */
export const COMPANY = {
  legalName: "Evangelist Funeral Services, Inc.",
  tradingName: "Evangelist Funeral Services",
  motto: "To Care And To Serve!",
  business: "Pre-need deathcare and memorial life plans",
  mainOffice: {
    label: "Main Office (Malaybalay)",
    lines: [
      "2nd Floor, Gabrinez Bldg, Fortich St.",
      "Malaybalay City, Bukidnon 8700",
    ],
    city: "Malaybalay City, Bukidnon, Philippines",
  },
  hotline: "0955 399 1034",
  email: "evangelistfuneralservices@gmail.com",
  officeHours: "Monday to Saturday, 8:00 AM – 5:00 PM",
  /** 24/7 line for families already holding a plan. */
  afterHours: "24/7 hotline for families holding an active plan",
} as const;

/** Printed at the top of every policy. Bump this when a policy changes. */
export const POLICY_LAST_UPDATED = "October 3, 2026";

/**
 * Version stamped on a consent record. Written to the planholder document so a
 * later change to the wording does not silently rewrite what was agreed to.
 */
export const CONSENT_VERSION = "2026-10-03";

export type LegalDoc = {
  to: string;
  title: string;
  /** Used in the footer and the policy index. */
  short: string;
  summary: string;
};

/** The policy set, in the order the footer lists them. */
export const LEGAL_DOCS: LegalDoc[] = [
  {
    to: "/legal/privacy",
    title: "Privacy Policy",
    short: "Privacy Policy",
    summary:
      "What personal data we hold, why we hold it, who we share it with, and how to get it corrected or deleted.",
  },
  {
    to: "/legal/terms",
    title: "Terms of Service",
    short: "Terms of Use",
    summary:
      "The rules for using this website and the portal: who may use it, what the records mean, and what we do not promise.",
  },
  {
    to: "/legal/refunds",
    title: "Refund Policy",
    short: "Refund Policy",
    summary:
      "What a plan costs, what is refundable, how long a refund takes, and the fees (if any) that apply.",
  },
  {
    to: "/legal/cookies",
    title: "Cookie Policy",
    short: "Cookie Policy",
    summary:
      "Every cookie and piece of stored data this site uses — which is a short list, because it only uses what sign-in needs.",
  },
  {
    to: "/legal/accessibility",
    title: "Accessibility Statement",
    short: "Accessibility",
    summary:
      "How this site is built for keyboard and screen-reader use, the contrast and text-size choices, and how to report a barrier.",
  },
];

export const DATA_REQUEST_PATH = "/privacy-request";

/* ── Cookies ──────────────────────────────────────────────────────────────── */

/** localStorage key holding the visitor's cookie decision. */
export const COOKIE_CONSENT_KEY = "evangelist:cookie-notice";

export type StorageItem = {
  name: string;
  kind: "cookie" | "local storage" | "session storage";
  purpose: string;
  /** How long it stays on the device. */
  duration: string;
  removable: boolean;
};

/**
 * The complete inventory of stored data on this site. It is deliberately short:
 * there is no analytics script, no advertising pixel, and no third-party
 * tracker, so there is nothing to consent to beyond keeping you signed in.
 */
export const STORAGE_INVENTORY: StorageItem[] = [
  {
    name: "ConvexAuth session token",
    kind: "cookie",
    purpose: "Keeps you signed in to the staff or client portal.",
    duration: "Expires with the session",
    removable: true,
  },
  {
    name: "Convex client credentials",
    kind: "cookie",
    purpose:
      "Short-lived keys the browser presents to the database to prove who you are.",
    duration: "Minutes to hours",
    removable: true,
  },
  {
    name: "theme",
    kind: "local storage",
    purpose: "Remembers whether you chose the light or dark version.",
    duration: "Until you clear it",
    removable: true,
  },
  {
    name: "evangelist:route-reload",
    kind: "session storage",
    purpose:
      "Marks that a page already reloaded once after a stale code split, so the app cannot reload in a loop.",
    duration: "Until the tab is closed",
    removable: true,
  },
  {
    name: COOKIE_CONSENT_KEY,
    kind: "local storage",
    purpose: "Records that you have seen the notice, so it is not shown again.",
    duration: "Until you clear it",
    removable: true,
  },
];

/* ── Third parties (item: audit third-party SDKs) ────────────────────────── */

/** Does this service receive a planholder's personal data, or only assets? */
export type ProcessorCategory = "data" | "account" | "asset" | "build";

export type ThirdPartyService = {
  name: string;
  purpose: string;
  /** Exactly what leaves this site, if anything. */
  shares: string;
  category: ProcessorCategory;
  /** Where the terms live. */
  url: string;
  /** A package in package.json, or a host we call directly. */
  source: string;
};

/**
 * Every outside service this application talks to. Reviewed on 3 October 2026
 * — see THIRD_PARTY_LICENSES.md in the repository root for the full audit note.
 */
export const THIRD_PARTY_SERVICES: ThirdPartyService[] = [
  {
    name: "Convex",
    purpose:
      "The database, file store, and live query server that hold every planholder record.",
    shares:
      "All planholder data you enter: name, date of birth, contact details, address, plan, payments and receipts.",
    category: "data",
    url: "https://www.convex.dev/privacy",
    source: "convex",
  },
  {
    name: "Convex Auth",
    purpose:
      "Sign-in. It issues the six-digit code and validates the session that keeps you logged in.",
    shares: "Your email address, and whether the code you were sent was correct.",
    category: "account",
    url: "https://convex.dev",
    source: "@convex-dev/auth",
  },
  {
    name: "Freebuff email relay",
    purpose:
      "Delivers the sign-in code to your inbox. We never see the contents of that email.",
    shares: "Your email address and the one-time code, for the length of the request.",
    category: "account",
    url: "https://freebuff.com",
    source: "POST auth.freebuff.app/send_otp (src/convex/auth/emailOtp.ts)",
  },
  {
    name: "Airtable",
    purpose:
      "Optional export. If the office connects an Airtable base, staff can push clients, contracts, payments and receipts into it to build their own views and read-only dashboards.",
    shares:
      "The planholder record — name, contact details, plan, payments and receipts. Blank fields are omitted. Nothing is pushed until the office supplies an Airtable token, and a branch can only push its own branch.",
    category: "data",
    url: "https://airtable.com/privacy",
    source: "POST api.airtable.com (src/convex/airtable.ts)",
  },
  {
    name: "Twilio",
    purpose:
      "Sends collection reminders and branch notices by SMS. Only sent by staff, to the number on the record.",
    shares: "Your name and mobile number, for the messages staff send you.",
    category: "data",
    url: "https://www.twilio.com/legal/privacy",
    source: "POST api.twilio.com (src/convex/sms.ts)",
  },
  {
    name: "Unsplash",
    purpose: "Supplies the photographs on the public pages of this site.",
    shares:
      "Your IP address and browser details, as with any image host. No planholder data is involved.",
    category: "asset",
    url: "https://unsplash.com/license",
    source: "images.unsplash.com (src/pages/Landing.tsx)",
  },
  {
    name: "jsPDF and html2canvas",
    purpose:
      "Turn the Statement of Account on screen into the PDF you print or download.",
    shares:
      "Nothing. Both run entirely inside your browser; no statement ever leaves the device.",
    category: "build",
    url: "https://github.com/eonasdan/jspdf",
    source: "jspdf, html2canvas",
  },
  {
    name: "SheetJS and Papa Parse",
    purpose:
      "Read the office spreadsheet you choose to bulk-upload, in your browser, before anything is saved.",
    shares: "Nothing. The file is parsed locally.",
    category: "build",
    url: "https://sheetjs.com",
    source: "xlsx, papaparse",
  },
  {
    name: "date-fns, Lucide, Framer Motion, Recharts, Radix UI",
    purpose:
      "Open-source libraries for dates, icons, animation, charts, and interface parts. They run locally and send nothing.",
    shares: "Nothing.",
    category: "build",
    url: "https://github.com/radix-ui",
    source: "date-fns, lucide-react, framer-motion, recharts, @radix-ui/*",
  },
];

/** Services that actually receive personal data — the ones that matter most. */
export const DATA_PROCESSORS = THIRD_PARTY_SERVICES.filter(
  (s) => s.category === "data" || s.category === "account"
);

/* ── Consents (item: check form consents) ───────────────────────────────── */

export const PRIVACY_CONSENT_LABEL =
  "The planholder has been told, in the language they understand, how their personal data will be used and stored, and has agreed to it.";

export const AGE_CONSENT_LABEL =
  "I confirm the planholder is 18 or older. If the planholder is under 18, I am their parent or legal guardian and I am giving this consent on their behalf.";

/** Checkbox shown when the planholder is a minor. */
export const GUARDIAN_CONSENT_LABEL =
  "I am the parent or legal guardian of this planholder and I consent to their record being opened and kept.";

/** Age below which the guardian rule applies. */
export const MINOR_AGE = 18;

export function isMinor(dateOfBirth: number, now = Date.now()): boolean {
  const age =
    (now - dateOfBirth) / (1000 * 60 * 60 * 24 * 365.2425);
  return age < MINOR_AGE;
}

/* ── Privacy requests (item: data deletion request) ──────────────────────── */

export const REQUEST_KINDS = [
  {
    value: "delete",
    label: "Delete my data",
    blurb:
      "Ask us to remove your planholder record and personal details. Financial and tax records we are legally required to keep are explained on the request.",
  },
  {
    value: "access",
    label: "See the data you hold",
    blurb: "Request a copy of everything you hold about me.",
  },
  {
    value: "correct",
    label: "Correct something",
    blurb: "Tell us a detail on my record is wrong and ask for it to be fixed.",
  },
  {
    value: "stop_messages",
    label: "Stop non-essential messages",
    blurb:
      "Stop payment reminders and branch notices by SMS or email. Sign-in codes still arrive, because they are needed to prove who you are.",
  },
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number]["value"];

export function isRequestKind(value: unknown): value is RequestKind {
  return REQUEST_KINDS.some((k) => k.value === value);
}

export function requestKindLabel(value: string): string {
  return REQUEST_KINDS.find((k) => k.value === value)?.label ?? value;
}

/** What a submitted request must contain, checked the same way on both sides. */
export type RequestDraft = {
  kind: string;
  name: string;
  email: string;
  contactNumber?: string | undefined;
  planNumber?: string | undefined;
  branch?: string | undefined;
  details?: string | undefined;
};

export type RequestIssue = { field: string; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Deliberately permissive: a client who types their address as
 * "0917 000 0000" must not be told it is invalid.
 */
export function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Validate a request the same way on the server and in the browser, so the
 * office never receives a submission it cannot act on.
 */
export function validateRequest(
  draft: RequestDraft
): RequestIssue[] {
  const issues: RequestIssue[] = [];
  if (!isRequestKind(draft.kind)) {
    issues.push({ field: "kind", message: "Choose what you would like us to do." });
  }
  if (draft.name.trim().length < 2) {
    issues.push({ field: "name", message: "Enter your full name." });
  }
  if (!looksLikeEmail(draft.email)) {
    issues.push({ field: "email", message: "Enter a working email address." });
  }
  // A deletion or correction request cannot be matched to a record without a
  // way to reach the person, so one of the two identifiers is required.
  const hasContact = (draft.contactNumber ?? "").trim().length >= 7;
  const hasPlan = (draft.planNumber ?? "").trim().length > 0;
  if (!hasContact && !hasPlan) {
    issues.push({
      field: "contactNumber",
      message:
        "Give the mobile number or plan number on your record so we can find it.",
    });
  }
  if (draft.details && draft.details.length > 2000) {
    issues.push({
      field: "details",
      message: "Please keep the details under 2000 characters.",
    });
  }
  return issues;
}

/* ── Hidden fees / charges ───────────────────────────────────────────────── */

/**
 * The only amounts a planholder is ever charged by this system. There is no
 * enrolment fee, no monthly service fee, and no charge for using the portal —
 * the statements above are the whole price.
 */
export const NO_HIDDEN_FEES_STATEMENT =
  "The amount printed on your plan is the only amount we charge: the plan value and the monthly installment. We do not add an enrolment fee, a monthly service fee, or a fee to view or download your statement, and we do not sell your details to anyone.";

/** What we do not do to planholders — the anti-dark-pattern promise. */
export const COLLECTION_PROMISE = [
  "We will not call, text, or message you to pressure you into paying.",
  "We will not add charges to your plan that are not printed on it.",
  "We will not ask for your sign-in code — not by phone, not by text, not by email, and not by anyone claiming to be from the office.",
  "We will not sell, rent, or trade your details to another company.",
];