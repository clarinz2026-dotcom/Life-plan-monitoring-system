/**
 * App-root composition guard.
 *
 * `CookieNotice` renders a react-router `<Link>` to the cookie policy, which
 * means it must be a descendant of `<BrowserRouter>`. Mounted beside the router
 * instead of inside it, `useContext(NavigationContext)` returns null and the
 * whole app dies on first paint with:
 *
 *   TypeError: Cannot destructure property 'basename' of
 *   'React.useContext(...)' as it is null.
 *
 * That is a blank preview, not a degraded feature, and nothing else in the test
 * suite renders the real root tree — so the invariant is asserted directly.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import CookieNotice from "../src/components/CookieNotice";
import { STORAGE_INVENTORY } from "../src/lib/legal";

const mainTsx = readFileSync(
  fileURLToPath(new URL("../src/main.tsx", import.meta.url)),
  "utf8"
);

describe("the cookie notice is mounted inside the router", () => {
  const routerStart = mainTsx.indexOf("<BrowserRouter");
  const routerEnd = mainTsx.indexOf("</BrowserRouter>");
  const mount = mainTsx.indexOf("<CookieNotice");

  test("main.tsx declares a BrowserRouter and mounts the notice", () => {
    expect(routerStart).toBeGreaterThan(-1);
    expect(routerEnd).toBeGreaterThan(routerStart);
    expect(mount).toBeGreaterThan(-1);
  });

  test("the mount falls between <BrowserRouter> and </BrowserRouter>", () => {
    expect(mount).toBeGreaterThan(routerStart);
    expect(mount).toBeLessThan(routerEnd);
  });

  test("the link it renders targets a declared public route", () => {
    // A live link to a route that doesn't exist is the same class of failure.
    expect(mainTsx).toContain('path="/legal/cookies"');
  });
});

describe("the cookie notice renders when mounted correctly", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <CookieNotice />
    </MemoryRouter>
  );

  test("it links to the cookie policy", () => {
    expect(html).toContain('href="/legal/cookies"');
  });

  test("it states the real storage inventory, not a generic message", () => {
    // The count comes from the same constant the cookie policy table uses, so
    // the notice cannot drift away from what is actually stored.
    expect(html).toContain(`We use ${STORAGE_INVENTORY.length} cookies`);
    expect(html).toContain(
      "No advertising, no analytics, no third-party trackers"
    );
  });

  test("it does not offer a fake accept/reject pair", () => {
    expect(html).not.toMatch(/reject/i);
    expect(html).not.toMatch(/decline all/i);
  });
});
