/**
 * Loading-state render check — server-renders the shared loading components and
 * the progress bar, and asserts each exposes the accessibility hooks a loading
 * state needs. Read-only; renders no app data and touches no database.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ConvexProvider } from "convex/react";
import { MemoryRouter } from "react-router";
import { PageLoading, InlineLoading } from "@/components/PageLoading";
import { RouteProgress } from "@/components/RouteProgress";

// The loading states read the configured logo through Convex, and the progress
// bar reads connection state, so every render needs a provider. A client that
// never emits stands in for the live backend.
const client = {
  watchQuery: () => ({
    localQueryResult: () => undefined,
    subscribe: () => () => undefined,
  }),
  connectionState: () => ({
    isWebSocketConnected: true,
    hasInflightRequests: false,
    inflightMutations: 0,
  }),
  subscribeToConnectionState: (cb: (state: unknown) => void) => {
    cb({
      isWebSocketConnected: true,
      hasInflightRequests: false,
      inflightMutations: 0,
    });
    return () => undefined;
  },
} as unknown as Parameters<typeof ConvexProvider>[0]["client"];

const inProviders = (node: React.ReactNode, path = "/dashboard") =>
  createElement(
    ConvexProvider,
    { client },
    createElement(MemoryRouter, { initialEntries: [path] }, node)
  );

const page = renderToStaticMarkup(inProviders(createElement(PageLoading, { label: "Loading dashboard" })));
const inline = renderToStaticMarkup(inProviders(createElement(InlineLoading, { label: "Loading clients" })));
const bar = renderToStaticMarkup(inProviders(createElement(RouteProgress, null)));

const checks: [string, boolean][] = [
  // Page loading state.
  ["page state marks itself busy", page.includes('aria-busy="true"')],
  ["page state announces politely", page.includes('aria-live="polite"')],
  ["page state is a status region", page.includes('role="status"')],
  ["page state shows its label", page.includes("Loading dashboard")],
  // Inline loading state.
  ["inline state marks itself busy", inline.includes('aria-busy="true"')],
  ["inline state is a status region", inline.includes('role="status"')],
  ["inline state shows its label", inline.includes("Loading clients")],
  // Progress bar: idle on a first paint, so it never flashes on load.
  ["bar is hidden while idle", !bar.includes('role="progressbar"')],
];

let bad = 0;
for (const [label, ok] of checks) {
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
}
console.log(bad === 0 ? "\nLoading states render as expected." : `\n${bad} check(s) failed.`);

process.exit(bad === 0 ? 0 : 1);
