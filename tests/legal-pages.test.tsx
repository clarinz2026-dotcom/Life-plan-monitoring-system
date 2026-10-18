/**
 * Policy page render tests.
 *
 * A policy that compiles but says the wrong thing is worse than no policy, so
 * these render the real pages and check the content a planholder would read:
 * the processor table lists every service that touches their data, the refund
 * table shows the prices the office actually charges, the cookie table matches
 * the storage inventory, and every page offers a way to make a data request.
 */
import { describe, expect, test, vi } from "vitest";
import React from "react";

// The policy pages read one setting through Convex (the logo in the header).
// Stub it: these tests are about what the page *says*, and standing up a live
// deployment (or the provider tree around it) would prove nothing extra.
vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => async () => undefined,
}));
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import Privacy from "../src/pages/legal/Privacy";
import Terms from "../src/pages/legal/Terms";
import Refunds from "../src/pages/legal/Refunds";
import Cookies from "../src/pages/legal/Cookies";
import Accessibility from "../src/pages/legal/Accessibility";
import Landing from "../src/pages/Landing";
import {
  COMPANY,
  DATA_PROCESSORS,
  LEGAL_DOCS,
  NO_HIDDEN_FEES_STATEMENT,
  STORAGE_INVENTORY,
} from "../src/lib/legal";
import { PLAN_FORMULATIONS } from "../src/lib/planFormulation";

const peso = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { maximumFractionDigits: 0 });

function render(page: React.ComponentType) {
  // Capitalised, so JSX treats it as a component rather than a <page> element.
  const Page = page;
  return renderToStaticMarkup(
    <MemoryRouter>
      <Page />
    </MemoryRouter>
  );
}

const PAGES = [
  ["Privacy Policy", Privacy],
  ["Terms of Service", Terms],
  ["Refund Policy", Refunds],
  ["Cookie Policy", Cookies],
  ["Accessibility Statement", Accessibility],
] as const;

describe("policy pages render for the public", () => {
  test.each(PAGES)("%s renders with its business details", (title, Page) => {
    const html = render(Page);
    expect(html).toContain(title);
    // Business details must be findable on the page itself (item 16).
    expect(html).toContain("Evangelist Funeral Services, Inc.");
    expect(html).toContain("0955 399 1034");
    expect(html).toContain("Gabrinez Bldg");
    // Business hours too, not just the footer of the site.
    expect(html).toContain("8:00 AM");
    // The logo is the only image on these pages, and it needs a real
    // description rather than the bare word "Logo".
    expect(html).toContain('alt="Evangelist Funeral Services logo"');
  });

  test.each(PAGES)("%s offers a way to make a data request", (_title, Page) => {
    const html = render(Page);
    expect(html).toContain('href="/privacy-request"');
  });
});

describe("the privacy notice names every processor", () => {
  const html = render(Privacy);

  test.each(DATA_PROCESSORS.map((s) => s.name))(
    "%s is listed with what it receives",
    (name) => {
      expect(html).toContain(name);
    }
  );

  test("the office's own contact address is given for complaints", () => {
    expect(html).toContain(COMPANY.email);
  });

  test("it states that the sign-in code is never asked for", () => {
    expect(html).toContain("sign-in code");
  });
});

describe("the refund policy publishes the real prices", () => {
  const html = render(Refunds);

  test.each(PLAN_FORMULATIONS.map((p) => p.name))(
    "%s shows the plan value and the monthly amount",
    (name) => {
      expect(html).toContain(name);
    }
  );

  test("the amounts match the office formulation", () => {
    for (const plan of PLAN_FORMULATIONS) {
      expect(html).toContain(peso(plan.planAmount));
      expect(html).toContain(peso(plan.monthly));
    }
  });

  test("it states the no-hidden-fees position", () => {
    expect(html).toContain(NO_HIDDEN_FEES_STATEMENT);
  });
});

describe("the cookie policy matches what the app actually stores", () => {
  const html = render(Cookies);

  test.each(STORAGE_INVENTORY.map((i) => i.name))(
    "%s is listed",
    (name) => {
      expect(html).toContain(name);
    }
  );

  test("it says plainly that there are no trackers", () => {
    expect(html).toContain(
      "no advertising, no analytics, and no third-party tracking"
    );
    expect(html).toContain("No analytics or session-recording scripts");
  });
});

describe("the public site does not make claims it cannot back", () => {
  const html = render(Landing);

  test("the footer policy links are real links, not dead ones", () => {
    // Every policy in the footer must resolve to a route that exists.
    for (const doc of LEGAL_DOCS) {
      expect(html).toContain(`href="${doc.to}"`);
    }
    expect(html).toContain('href="/privacy-request"');
    // No link may point at a placeholder anchor that does nothing.
    expect(html).not.toContain('href="#contact"');
  });

  test("no unverifiable trustmark claim", () => {
    expect(html).not.toContain("DTI Trust Mark");
    expect(html).not.toContain("verified merchant");
  });

  test("sample figures are labelled as samples", () => {
    expect(html).toContain("illustrative figures — not a real account");
    expect(html).toContain("Illustrative example — not a real planholder");
    expect(html).toContain("Illustrative example, not a real");
    expect(html).toContain("Illustrative example — not a real person");
    expect(html).toContain("Illustrative list, not real accounts");
  });

  test("business details and the fee position are on the page", () => {
    expect(html).toContain("Evangelist Funeral Services, Inc.");
    expect(html).toContain("Gabrinez Bldg");
    expect(html).toContain(NO_HIDDEN_FEES_STATEMENT);
  });

  test("every image carries alternative text", () => {
    const images = html.match(/<img\b[^>]*>/g) ?? [];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toMatch(/alt="[^"]+"/);
    }
  });

  test("the sample records are fictional, not a real planholder's data", () => {
    // A real planholder's name or date of birth must never appear on a public
    // page — the cards are demos, so they carry placeholder people only.
    expect(html).not.toContain("Abrasaldo");
    expect(html).not.toContain("Clarinz");
    expect(html).not.toContain("June 2, 2002");
    expect(html).not.toContain("Aug 22, 2026");
    // The placeholder that replaced it.
    expect(html).toContain("Dela Cruz, Juanita M.");
  });
});