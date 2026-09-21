/**
 * "System Flow" PowerPoint deck for Evangelist Funeral Services OPC.
 *
 * The deck walks the proposal through the two ways the product is entered — the
 * staff side (branch operations) and the client side (families and planholders)
 * — and then shows exactly where the two meet. It is generated in the browser
 * with pptxgenjs, so the file is a genuine .pptx that opens in PowerPoint,
 * Keynote, Google Slides and LibreOffice.
 *
 * Layout is 16:9 at 10" × 5.625". Every slide is composed from the same small
 * set of primitives (`addChrome`, `addStepRow`, `addStep`, `addPanel`, `addBand`)
 * so the deck stays visually consistent as it grows.
 */
import PptxGenJS from "pptxgenjs";

// ── Canvas & brand ──────────────────────────────────────────────────────────

const W = 10;
const H = 5.625;
const M = 0.58;
const CW = W - M * 2; // 8.84" of usable width
const CONTENT_TOP = 1.46;
const CONTENT_BOTTOM = H - 0.58;

/** The app's own palette (see `src/index.css`), so the deck matches the product. */
const C = {
  evergreen: "1B4332",
  pine: "10291D",
  moss: "2D6A4F",
  sage: "DCE5DD",
  gold: "A9874F",
  goldSoft: "D9C49C",
  cream: "FAF7EF",
  paper: "FDFCF8",
  ink: "211F1A",
  stone: "716C60",
  line: "E6DFD1",
  white: "FFFFFF",
  mist: "EDF2EE",
} as const;

const SERIF = "Georgia";
const SANS = "Arial";

type Tone = "outline" | "evergreen" | "moss" | "gold" | "sand";

interface Step {
  /** Optional chip number shown on the top edge of the box. */
  n?: string;
  label: string;
  sub?: string;
  tone?: Tone;
}

function toneFill(tone: Tone): string {
  if (tone === "evergreen") return C.evergreen;
  if (tone === "moss") return C.moss;
  if (tone === "gold") return C.gold;
  if (tone === "sand") return C.mist;
  return C.paper;
}

function toneText(tone: Tone): string {
  if (tone === "outline" || tone === "sand") return C.ink;
  return C.white;
}

function toneSubText(tone: Tone): string {
  if (tone === "outline" || tone === "sand") return C.stone;
  if (tone === "gold") return "F7EFE0";
  return "CFE0D6";
}

// ── Slide furniture ─────────────────────────────────────────────────────────

function addChrome(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  kicker: string,
  title: string,
  sub?: string
) {
  slide.background = { color: C.cream };

  // Left spine: an evergreen rule with a gold cap, echoing the SOA letterhead.
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.13, h: H, fill: { color: C.evergreen } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.13, h: 1.05, fill: { color: C.gold } });

  slide.addText(kicker.toUpperCase(), {
    x: M,
    y: 0.33,
    w: CW,
    h: 0.22,
    fontSize: 9.5,
    bold: true,
    color: C.gold,
    charSpacing: 2.5,
    fontFace: SANS,
  });
  slide.addText(title, {
    x: M,
    y: 0.55,
    w: CW,
    h: 0.46,
    fontSize: 24,
    bold: true,
    color: C.evergreen,
    fontFace: SERIF,
  });
  if (sub) {
    slide.addText(sub, {
      x: M,
      y: 1.0,
      w: CW,
      h: 0.28,
      fontSize: 10.5,
      color: C.stone,
      fontFace: SANS,
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: M,
    y: sub ? 1.34 : 1.12,
    w: CW,
    h: 0,
    line: { color: C.line, width: 1 },
  });
}

function addFooter(pptx: PptxGenJS, slide: PptxGenJS.Slide, page: number) {
  slide.addShape(pptx.ShapeType.line, {
    x: M,
    y: H - 0.46,
    w: CW,
    h: 0,
    line: { color: C.line, width: 0.75 },
  });
  slide.addText("Evangelist Funeral Services OPC   ·   Records, Payments & Client Portal", {
    x: M,
    y: H - 0.42,
    w: CW - 0.8,
    h: 0.26,
    fontSize: 7.5,
    color: C.stone,
    fontFace: SANS,
  });
  slide.addText(String(page), {
    x: W - M - 0.6,
    y: H - 0.42,
    w: 0.6,
    h: 0.26,
    fontSize: 8,
    bold: true,
    color: C.gold,
    align: "right",
    fontFace: SANS,
  });
}

/** A single flow step: rounded box, optional number chip, label + caption. */
function addStep(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  step: Step,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const tone = step.tone ?? "outline";
  const fill = toneFill(tone);
  const fg = toneText(tone);

  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.07,
    fill: { color: fill },
    line: { color: tone === "outline" || tone === "sand" ? C.line : fill, width: 1 },
  });

  if (step.n) {
    const chip = 0.24;
    const cx = x + w / 2 - chip / 2;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: cx,
      y: y - chip / 2,
      w: chip,
      h: chip,
      fill: { color: C.white },
      line: { color: C.gold, width: 1 },
    });
    slide.addText(step.n, {
      x: cx,
      y: y - chip / 2,
      w: chip,
      h: chip,
      fontSize: 8,
      bold: true,
      color: C.gold,
      align: "center",
      valign: "middle",
      fontFace: SANS,
    });
  }

  const padTop = step.n ? 0.22 : 0.12;
  slide.addText(step.label, {
    x: x + 0.08,
    y: y + padTop,
    w: w - 0.16,
    h: 0.32,
    fontSize: 9.5,
    bold: true,
    color: fg,
    align: "center",
    valign: "top",
    fontFace: SANS,
  });

  if (step.sub) {
    slide.addText(step.sub, {
      x: x + 0.08,
      y: y + padTop + 0.3,
      w: w - 0.16,
      h: h - padTop - 0.34,
      fontSize: 7.5,
      color: toneSubText(tone),
      align: "center",
      valign: "top",
      fontFace: SANS,
      lineSpacingMultiple: 1.05,
    });
  }
}

/** A left-to-right flow with gold arrows between the steps. */
function addStepRow(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  steps: Step[],
  y: number,
  h: number,
  opts: { x?: number; w?: number; gap?: number } = {}
) {
  const x = opts.x ?? M;
  const w = opts.w ?? CW;
  const gap = opts.gap ?? 0.3;
  const n = steps.length;
  const boxW = (w - gap * (n - 1)) / n;

  steps.forEach((step, i) => {
    const bx = x + i * (boxW + gap);
    addStep(pptx, slide, step, bx, y, boxW, h);
    if (i < n - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: bx + boxW + 0.05,
        y: y + h / 2,
        w: gap - 0.1,
        h: 0,
        line: { color: C.gold, width: 1.5, endArrowType: "triangle" },
      });
    }
  });

  return boxW;
}

/** A titled content panel used for bullets, notes and value columns. */
function addPanel(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    tag?: string;
    lines?: string[];
    tone?: Tone;
    body?: string;
  }
) {
  const tone = opts.tone ?? "outline";
  const fill = toneFill(tone);
  const fg = toneText(tone);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: tone === "outline" ? C.line : fill, width: 1 },
  });

  slide.addText(opts.title, {
    x: opts.x + 0.18,
    y: opts.y + 0.14,
    w: opts.w - 0.36,
    h: 0.26,
    fontSize: 10.5,
    bold: true,
    color: tone === "sand" ? C.evergreen : fg,
    charSpacing: 1.2,
    fontFace: SANS,
  });

  let cursor = opts.y + 0.44;
  if (opts.tag) {
    slide.addText(opts.tag, {
      x: opts.x + 0.18,
      y: cursor,
      w: opts.w - 0.36,
      h: 0.24,
      fontSize: 8.5,
      color: toneSubText(tone),
      fontFace: SANS,
    });
    cursor += 0.26;
  }

  if (opts.lines?.length) {
    const step = (opts.h - (cursor - opts.y) - 0.14) / opts.lines.length;
    opts.lines.forEach((line, i) => {
      const ty = cursor + i * step;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: opts.x + 0.2,
        y: ty + step / 2 - 0.045,
        w: 0.09,
        h: 0.09,
        fill: { color: tone === "outline" || tone === "sand" ? C.gold : C.goldSoft },
        line: { color: "FFFFFF", width: 0 },
      });
      slide.addText(line, {
        x: opts.x + 0.4,
        y: ty,
        w: opts.w - 0.58,
        h: step,
        fontSize: 9.5,
        color: tone === "outline" ? C.ink : tone === "sand" ? C.ink : "EAF1EC",
        valign: "middle",
        fontFace: SANS,
      });
    });
  }

  if (opts.body) {
    slide.addText(opts.body, {
      x: opts.x + 0.18,
      y: cursor,
      w: opts.w - 0.36,
      h: opts.h - (cursor - opts.y) - 0.14,
      fontSize: 9.5,
      color: tone === "outline" || tone === "sand" ? C.ink : "EAF1EC",
      valign: "top",
      fontFace: SANS,
      lineSpacingMultiple: 1.15,
    });
  }
}

/** A full-width callout band. */
function addBand(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  y: number,
  h: number,
  title: string,
  body: string,
  tone: Tone = "evergreen"
) {
  const fill = toneFill(tone);
  slide.addShape(pptx.ShapeType.roundRect, {
    x: M,
    y,
    w: CW,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: tone === "outline" || tone === "sand" ? C.line : fill, width: 1 },
  });
  slide.addText(title, {
    x: M + 0.2,
    y: y + 0.11,
    w: CW - 0.4,
    h: 0.24,
    fontSize: 10,
    bold: true,
    color: toneText(tone) === C.ink ? C.evergreen : toneText(tone),
    charSpacing: 1.1,
    fontFace: SANS,
  });
  slide.addText(body, {
    x: M + 0.2,
    y: y + 0.36,
    w: CW - 0.4,
    h: h - 0.46,
    fontSize: 9,
    color: tone === "outline" || tone === "sand" ? C.stone : "E7EFE9",
    fontFace: SANS,
    lineSpacingMultiple: 1.1,
  });
}

// ── Slides ──────────────────────────────────────────────────────────────────

function titleSlide(pptx: PptxGenJS) {
  const slide = pptx.addSlide();
  slide.background = { color: C.evergreen };

  // Gold hairline frame, like the ruled border of the printed statement.
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.34,
    y: 0.34,
    w: W - 0.68,
    h: H - 0.68,
    fill: { type: "none", color: C.evergreen },
    line: { color: C.gold, width: 0.75 },
  });

  slide.addText("EVANGELIST FUNERAL SERVICES OPC", {
    x: 0.9,
    y: 1.12,
    w: W - 1.8,
    h: 0.28,
    fontSize: 11,
    bold: true,
    color: C.goldSoft,
    charSpacing: 3.5,
    align: "center",
    fontFace: SANS,
  });

  slide.addShape(pptx.ShapeType.line, {
    x: W / 2 - 1.1,
    y: 1.52,
    w: 2.2,
    h: 0,
    line: { color: C.gold, width: 1.25 },
  });

  slide.addText("Records, Payments\n& Client Portal", {
    x: 0.7,
    y: 1.74,
    w: W - 1.4,
    h: 1.3,
    fontSize: 40,
    bold: true,
    color: C.white,
    align: "center",
    valign: "middle",
    fontFace: SERIF,
    lineSpacingMultiple: 0.95,
  });

  slide.addText("System Flow  —  the client side and the staff side", {
    x: 0.7,
    y: 3.12,
    w: W - 1.4,
    h: 0.32,
    fontSize: 14,
    color: C.goldSoft,
    align: "center",
    fontFace: SANS,
  });

  slide.addText(
    "Prepared for Evangelist Funeral Services OPC   ·   2nd Floor, Gabrinez Bldg, Fortich St., Malaybalay City, Bukidnon",
    {
      x: 0.9,
      y: 3.62,
      w: W - 1.8,
      h: 0.26,
      fontSize: 8.5,
      color: "9FB8A8",
      align: "center",
      fontFace: SANS,
    }
  );

  slide.addText('"To Care and To Serve"', {
    x: 0.9,
    y: 4.36,
    w: W - 1.8,
    h: 0.3,
    fontSize: 12,
    italic: true,
    color: C.gold,
    align: "center",
    fontFace: SERIF,
  });

  slide.addText("Service Today.  Peace Forever.", {
    x: 0.9,
    y: 4.66,
    w: W - 1.8,
    h: 0.26,
    fontSize: 9,
    color: "9FB8A8",
    align: "center",
    charSpacing: 2,
    fontFace: SANS,
  });
}

function overviewSlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "The shape of the system",
    "Two doors, one record",
    "Families and branch staff enter the same system from opposite sides — and meet in the same records."
  );

  const colW = (CW - 0.36) / 2;
  const panelY = CONTENT_TOP + 0.3;
  const panelH = 2.15;

  addPanel(pptx, slide, {
    x: M,
    y: panelY,
    w: colW,
    h: panelH,
    title: "CLIENT SIDE  ·  /portal",
    tag: "Families & planholders",
    tone: "sand",
    lines: [
      "Signs in with their own account",
      "Asks to be linked to their plan",
      "Sees every plan they hold",
      "Payments summary and balance",
      "Downloads their statement (SOA)",
    ],
  });

  addPanel(pptx, slide, {
    x: M + colW + 0.36,
    y: panelY,
    w: colW,
    h: panelH,
    title: "STAFF SIDE  ·  /dashboard",
    tag: "Branch operations",
    tone: "sand",
    lines: [
      "Signs in scoped by role and branch",
      "Client files — new or bulk-imported",
      "Contracts, plans and beneficiaries",
      "Records payments and issues receipts",
      "Monitors collections, aging and audit",
    ],
  });

  // Both doors fall into the same record.
  const arrowY = panelY + panelH + 0.06;
  [M + colW / 2, M + colW + 0.36 + colW / 2].forEach((cx) => {
    slide.addShape(pptx.ShapeType.line, {
      x: cx,
      y: arrowY,
      w: 0,
      h: 0.3,
      line: { color: C.gold, width: 1.5, endArrowType: "triangle" },
    });
  });

  addBand(
    pptx,
    slide,
    arrowY + 0.32,
    0.66,
    "ONE SHARED RECORD  —  A SINGLE SOURCE OF TRUTH",
    "Client files · plans & contracts · beneficiaries · payments · official receipts · statements · audit trail",
    "evergreen"
  );

  addFooter(pptx, slide, page);
}

function staffDailySlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "Staff side  ·  1 of 3",
    "The daily loop — from a walk-in to a receipt",
    "The five steps a branch repeats every working day."
  );

  addStepRow(
    pptx,
    slide,
    [
      { n: "1", label: "Sign in", sub: "Role and branch scope applied", tone: "evergreen" },
      { n: "2", label: "Client file", sub: "Created, or bulk-imported", tone: "outline" },
      { n: "3", label: "Plan & contract", sub: "Type, value, monthly, beneficiaries", tone: "outline" },
      { n: "4", label: "Record payment", sub: "Single entry or bulk upload", tone: "outline" },
      { n: "5", label: "Receipt & ledger", sub: "Auto-numbered receipt; balance updated", tone: "gold" },
    ],
    CONTENT_TOP + 0.24,
    1.25
  );

  addBand(
    pptx,
    slide,
    CONTENT_TOP + 1.78,
    0.62,
    "THEN THE SYSTEM DOES THE REST, BY ITSELF",
    "The balance is recalculated, the installment count advances, the account status is re-derived, and the family's portal updates immediately.",
    "sand"
  );

  addStepRow(
    pptx,
    slide,
    [
      { label: "Balance recalculated", sub: "Straight off the ledger" },
      { label: "Installments advanced", sub: "Paid count vs. plan term" },
      { label: "Status re-derived", sub: "Current · 30 · 60 · 90 · Lapsed" },
      { label: "Family's portal updated", sub: "New figures, instantly" },
    ],
    CONTENT_TOP + 2.62,
    0.9
  );

  addFooter(pptx, slide, page);
}

function staffMonitoringSlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "Staff side  ·  2 of 3",
    "Monitoring the whole picture",
    "The manager's and head office's view of what the branches are actually collecting."
  );

  const gap = 0.3;
  const boxW = (CW - gap * 2) / 3;
  const boxH = 1.16;
  const rows: Step[][] = [
    [
      { label: "Dashboard", sub: "Collections at a glance and the accounts that need attention today" },
      { label: "Reports", sub: "Branch and company-wide totals, per period and per plan" },
      { label: "Aging Report", sub: "Accounts by 30 / 60 / 90 days and lapsed" },
    ],
    [
      { label: "Reconciliation", sub: "The cashier's daily cash count, closed and recorded" },
      { label: "Audit Log", sub: "Who changed what, and when — nothing is hidden" },
      { label: "Notifications", sub: "Linking requests and system alerts, in one place" },
    ],
  ];

  rows.forEach((row, r) => {
    row.forEach((step, c) => {
      addStep(pptx, slide, step, M + c * (boxW + gap), CONTENT_TOP + 0.22 + r * (boxH + 0.28), boxW, boxH);
    });
  });

  addBand(
    pptx,
    slide,
    CONTENT_TOP + 0.22 + 2 * boxH + 0.34,
    0.62,
    "EVERY BRANCH KEEPS ITS OWN BOOKS",
    "A branch sees only its own records. The CEO and Head Office can switch between ALL BRANCHES and any single one.",
    "sand"
  );

  addFooter(pptx, slide, page);
}

function staffMoneySlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "Staff side  ·  3 of 3",
    "The money thread",
    "One payment, followed all the way through — until it appears to the family."
  );

  addStepRow(
    pptx,
    slide,
    [
      { n: "1", label: "Payment recorded", sub: "Cashier or finance staff", tone: "evergreen" },
      { n: "2", label: "Official receipt", sub: "Numbered automatically", tone: "outline" },
      { n: "3", label: "Ledger entry", sub: "Written against the contract", tone: "outline" },
      { n: "4", label: "Balance & status", sub: "Recomputed from the ledger", tone: "outline" },
      { n: "5", label: "Seen everywhere", sub: "Staff, SOA, portal, reports", tone: "gold" },
    ],
    CONTENT_TOP + 0.22,
    1.22
  );

  const colW = (CW - 0.32) / 2;
  const y = CONTENT_TOP + 1.72;
  const h = 1.5;

  addPanel(pptx, slide, {
    x: M,
    y,
    w: colW,
    h,
    title: "EVERY FIGURE COMES FROM ONE LEDGER",
    tone: "evergreen",
    body: "The staff payments page, the printed statement, the client portal and the reports all read the same entries — so they cannot disagree with each other.",
  });

  addPanel(pptx, slide, {
    x: M + colW + 0.32,
    y,
    w: colW,
    h,
    title: "NOTHING IS EVER ERASED",
    tone: "gold",
    body: "A payment entered in error is reversed, not deleted: the amount comes off the plan, the receipt is cancelled, and the original entry stays on the record with who reversed it and when.",
  });

  addFooter(pptx, slide, page);
}

function clientFlowSlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "Client side  ·  1 of 2",
    "From a family's phone to their own statement",
    "What the planholder does, and what they get back."
  );

  addStepRow(
    pptx,
    slide,
    [
      { n: "1", label: "Create an account", sub: "On the website, with an email", tone: "evergreen" },
      { n: "2", label: "Request the link", sub: "Name, number, email, preferred branch", tone: "outline" },
      { n: "3", label: "Office verifies", sub: "Matched to the client file", tone: "outline" },
      { n: "4", label: "Records unlock", sub: "Their plans appear in the portal", tone: "outline" },
      { n: "5", label: "Their statement", sub: "Payments summary, SOA and receipts", tone: "gold" },
    ],
    CONTENT_TOP + 0.24,
    1.25
  );

  addBand(
    pptx,
    slide,
    CONTENT_TOP + 1.78,
    0.62,
    "NO VISIT REQUIRED ONCE VERIFIED",
    "The family can check their balance and download their statement at any hour, instead of calling the office or travelling to a branch.",
    "sand"
  );

  const colW = (CW - 0.32) / 2;
  const y = CONTENT_TOP + 2.52;

  addPanel(pptx, slide, {
    x: M,
    y,
    w: colW,
    h: 1.08,
    title: "MY PLANS",
    tone: "evergreen",
    body: "Every plan they hold, with the plan type, plan value and what has been paid so far.",
  });

  addPanel(pptx, slide, {
    x: M + colW + 0.32,
    y,
    w: colW,
    h: 1.08,
    title: "PAYMENTS SUMMARY & SOA",
    tone: "evergreen",
    body: "The full payment history, the outstanding balance, and the statement as a PDF to keep or print.",
  });

  addFooter(pptx, slide, page);
}

function accountLinkingSlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "Where the two sides meet",
    "Account linking — the family asks, the office decides",
    "A family can only ever see records the office has confirmed are theirs."
  );

  const laneLabelW = 1.15;
  const laneX = M + laneLabelW;
  const laneW = CW - laneLabelW;
  const laneH = 0.74;
  const laneGap = 0.16;
  const top = CONTENT_TOP + 0.2;

  const lanes: { name: string; tone: Tone; steps: Step[] }[] = [
    {
      name: "CLIENT",
      tone: "sand",
      steps: [
        { label: "Creates an account", sub: "Email sign-in" },
        { label: "Files a linking request", sub: "Name, number, email, branch" },
        { label: "Waits for the office", sub: "Status is visible in the portal" },
      ],
    },
    {
      name: "SYSTEM",
      tone: "evergreen",
      steps: [
        { label: "Alerts every staff account", sub: "In-app notification" },
        { label: "Holds one open request", sub: "No duplicates to review" },
        { label: "Notifies the outcome", sub: "Approved or declined, with reason" },
      ],
    },
    {
      name: "STAFF",
      tone: "sand",
      steps: [
        { label: "Reviews the request", sub: "Account Linking page" },
        { label: "Matches a client file", sub: "Guarded against duplicates" },
        { label: "Approves or declines", sub: "Reasons recorded on the request" },
      ],
    },
  ];

  lanes.forEach((lane, i) => {
    const y = top + i * (laneH + laneGap);

    slide.addShape(pptx.ShapeType.roundRect, {
      x: M,
      y,
      w: laneLabelW - 0.12,
      h: laneH,
      rectRadius: 0.07,
      fill: { color: lane.tone === "evergreen" ? C.evergreen : C.paper },
      line: { color: lane.tone === "evergreen" ? C.evergreen : C.line, width: 1 },
    });
    slide.addText(lane.name, {
      x: M,
      y,
      w: laneLabelW - 0.12,
      h: laneH,
      fontSize: 8.5,
      bold: true,
      color: lane.tone === "evergreen" ? C.white : C.evergreen,
      align: "center",
      valign: "middle",
      charSpacing: 1.2,
      fontFace: SANS,
    });

    addStepRow(pptx, slide, lane.steps, y, laneH, { x: laneX, w: laneW, gap: 0.26 });
  });

  addBand(
    pptx,
    slide,
    top + 3 * laneH + 2 * laneGap + 0.14,
    0.62,
    "APPROVED  →  THE FAMILY'S PLAN IS UNLOCKED      |      DECLINED  →  VISIT A BRANCH WITH A VALID ID",
    "One email address links to one client file only. The system refuses a second link, so a record can never be shown to the wrong family.",
    "sand"
  );

  addFooter(pptx, slide, page);
}

function migrationSlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "Bringing the records in",
    "Existing ledgers become live records",
    "The handwritten and legacy records are loaded from the spreadsheets the office already keeps."
  );

  addStepRow(
    pptx,
    slide,
    [
      { n: "1", label: "Spreadsheet in", sub: "CSV or Excel upload", tone: "evergreen" },
      { n: "2", label: "Layout detected", sub: "Recognises your existing reports", tone: "outline" },
      { n: "3", label: "Columns mapped", sub: "Names, LPA, plan type, dates, amounts", tone: "outline" },
      { n: "4", label: "Preview & correct", sub: "Every row checked before import", tone: "outline" },
      { n: "5", label: "Records live", sub: "Clients and their payment history", tone: "gold" },
    ],
    CONTENT_TOP + 0.24,
    1.25
  );

  const colW = (CW - 0.32) / 2;
  const y = CONTENT_TOP + 1.78;

  addPanel(pptx, slide, {
    x: M,
    y,
    w: colW,
    h: 1.42,
    title: "READS THE FORMATS YOU ALREADY USE",
    tone: "sand",
    body: "Monthly collection performance reports and old statement exports are read as they are — including dates like 22-Feb-2022, leading-zero LPA numbers, and amounts in pesos with commas.",
  });

  addPanel(pptx, slide, {
    x: M + colW + 0.32,
    y,
    w: colW,
    h: 1.42,
    title: "NOTHING IS COMMITTED BLIND",
    tone: "sand",
    body: "Every imported row appears in a preview first, with the monthly rate and contract number visible for correction. Records are only created when the office approves the batch.",
  });

  addFooter(pptx, slide, page);
}

function rolesSlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "Access",
    "Who sees what, and which branch",
    "Access is decided by position first, then narrowed to a branch."
  );

  const header = (t: string) => ({
    text: t,
    options: { bold: true, color: C.white, fill: { color: C.evergreen }, fontSize: 9.5, fontFace: SANS },
  });
  const cell = (t: string, opts: Record<string, unknown> = {}) => ({
    text: t,
    options: { fontSize: 9, color: C.ink, fontFace: SANS, ...opts },
  });

  const rows = [
    [header("Position"), header("Reach"), header("What they can do")],
    [
      cell("Super Admin / CEO", { bold: true }),
      cell("All branches"),
      cell("Everything: branches, plans and staff roles. Can view ALL BRANCHES, or any single one."),
    ],
    [
      cell("Branch Manager", { bold: true }),
      cell("Own branch"),
      cell("Runs the branch: clients, contracts, payments, reports, reconciliation, linking approvals."),
    ],
    [
      cell("Finance Staff", { bold: true }),
      cell("Own branch"),
      cell("Payments, receipts, bulk upload, reports and the aging report."),
    ],
    [
      cell("Cashier", { bold: true }),
      cell("Own branch"),
      cell("Records payments and issues receipts, then closes the daily cash reconciliation."),
    ],
    [
      cell("Collector / Agent", { bold: true }),
      cell("Own branch"),
      cell("Works the client records and their plans; no financial or administrative control."),
    ],
  ];

  slide.addTable(rows, {
    x: M,
    y: CONTENT_TOP + 0.18,
    w: CW,
    colW: [1.85, 1.35, 5.64],
    rowH: 0.48,
    border: { type: "solid", color: C.line, pt: 0.75 },
    fill: { color: C.paper },
    valign: "middle",
    margin: 0.08,
    autoPage: false,
  });

  addFooter(pptx, slide, page);
}

function twoWindowsSlide(pptx: PptxGenJS, page: number) {
  const slide = pptx.addSlide();
  addChrome(
    pptx,
    slide,
    "The result",
    "One statement, two windows",
    "The same records, read in the language each side needs."
  );

  const colW = (CW - 0.32) / 2;
  const y = CONTENT_TOP + 0.2;
  const h = 2.6;

  addPanel(pptx, slide, {
    x: M,
    y,
    w: colW,
    h,
    title: "WHAT THE FAMILY SEES",
    tag: "Plain, reassuring status wording",
    tone: "sand",
    lines: [
      "Good Payer",
      "Reinstated",
      "Lapsed",
      "Plan value, total paid, outstanding balance",
      "Full payment history and the printable SOA",
    ],
  });

  addPanel(pptx, slide, {
    x: M + colW + 0.32,
    y,
    w: colW,
    h,
    title: "WHAT THE OFFICE SEES",
    tag: "Operational, aged status wording",
    tone: "evergreen",
    lines: [
      "Current",
      "30 days · 60 days · 90 days",
      "Lapsed",
      "Collections, aging and reconciliation",
      "Audit log, receipts and reversals",
    ],
  });

  addBand(
    pptx,
    slide,
    y + h + 0.2,
    0.6,
    "THE PAPER AND THE SCREEN CANNOT DISAGREE",
    "Both windows are drawn from the same ledger entries, so the statement a family downloads is the statement the office would print.",
    "sand"
  );

  addFooter(pptx, slide, page);
}

function closingSlide(pptx: PptxGenJS) {
  const slide = pptx.addSlide();
  slide.background = { color: C.evergreen };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.34,
    y: 0.34,
    w: W - 0.68,
    h: H - 0.68,
    fill: { type: "none", color: C.evergreen },
    line: { color: C.gold, width: 0.75 },
  });

  slide.addText("WHAT THE SYSTEM DELIVERS", {
    x: 1,
    y: 0.95,
    w: W - 2,
    h: 0.26,
    fontSize: 10,
    bold: true,
    color: C.goldSoft,
    charSpacing: 3,
    align: "center",
    fontFace: SANS,
  });

  const items = [
    "One accurate record for every planholder",
    "Every payment receipted, traceable and reversible",
    "Families can see their own plan, any hour",
    "Head office sees every branch, branches see their own",
    "Nothing erased — every change on the audit trail",
  ];

  items.forEach((item, i) => {
    const y = 1.4 + i * 0.44;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 1.5,
      y: y + 0.11,
      w: 0.1,
      h: 0.1,
      fill: { color: C.gold },
      line: { color: C.gold, width: 0 },
    });
    slide.addText(item, {
      x: 1.76,
      y,
      w: W - 2.9,
      h: 0.32,
      fontSize: 12,
      color: C.white,
      valign: "middle",
      fontFace: SANS,
    });
  });

  slide.addShape(pptx.ShapeType.line, {
    x: W / 2 - 1.1,
    y: 3.78,
    w: 2.2,
    h: 0,
    line: { color: C.gold, width: 1.25 },
  });

  slide.addText('"To Care and To Serve"', {
    x: 1,
    y: 3.94,
    w: W - 2,
    h: 0.34,
    fontSize: 15,
    italic: true,
    color: C.gold,
    align: "center",
    fontFace: SERIF,
  });

  slide.addText(
    "24/7  0955 399 1034   ·   evangelistfuneralservices@gmail.com   ·   2nd Floor, Gabrinez Bldg, Fortich St., Malaybalay City, Bukidnon",
    {
      x: 0.9,
      y: 4.42,
      w: W - 1.8,
      h: 0.26,
      fontSize: 8.5,
      color: "9FB8A8",
      align: "center",
      fontFace: SANS,
    }
  );

  slide.addText("Service Today.  Peace Forever.", {
    x: 0.9,
    y: 4.72,
    w: W - 1.8,
    h: 0.24,
    fontSize: 8.5,
    color: "9FB8A8",
    align: "center",
    charSpacing: 2,
    fontFace: SANS,
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export const DECK_FILE_NAME = "Evangelist-System-Flow.pptx";

/** Titles of every slide, in order — used by the preview page outline. */
export const DECK_OUTLINE = [
  { title: "Records, Payments & Client Portal", track: "Cover" },
  { title: "Two doors, one record", track: "Overview" },
  { title: "The daily loop — from a walk-in to a receipt", track: "Staff side" },
  { title: "Monitoring the whole picture", track: "Staff side" },
  { title: "The money thread", track: "Staff side" },
  { title: "From a family's phone to their own statement", track: "Client side" },
  { title: "Account linking — the family asks, the office decides", track: "Both sides" },
  { title: "Existing ledgers become live records", track: "Getting started" },
  { title: "Who sees what, and which branch", track: "Access" },
  { title: "One statement, two windows", track: "The result" },
  { title: "What the system delivers", track: "Closing" },
] as const;

/** Builds the presentation. Kept separate from the download so it can be reused. */
export function buildSystemDeck(): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Evangelist Funeral Services OPC";
  pptx.company = "Evangelist Funeral Services OPC";
  pptx.title = "Records, Payments & Client Portal — System Flow";

  titleSlide(pptx);
  overviewSlide(pptx, 2);
  staffDailySlide(pptx, 3);
  staffMonitoringSlide(pptx, 4);
  staffMoneySlide(pptx, 5);
  clientFlowSlide(pptx, 6);
  accountLinkingSlide(pptx, 7);
  migrationSlide(pptx, 8);
  rolesSlide(pptx, 9);
  twoWindowsSlide(pptx, 10);
  closingSlide(pptx);

  return pptx;
}

/** Triggers the browser download of the deck. */
export async function downloadSystemDeck(): Promise<void> {
  await buildSystemDeck().writeFile({ fileName: DECK_FILE_NAME });
}
