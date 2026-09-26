/**
 * Sidebar render check — server-renders the staff sidebar in both of its states
 * and asserts what each is supposed to show. Read-only; renders no app data and
 * touches no database.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { ConvexProvider } from "convex/react";
import {
  SIDEBAR_RAIL,
  SIDEBAR_WIDTH,
  DesktopSidebar,
  MobileSidebar,
  Sidebar,
  SidebarAction,
  SidebarBrand,
  SidebarLink,
} from "@/components/StaffSidebar";

// The wordmark pulls the configured logo through Convex, so the render needs a
// provider. A client that never emits stands in for the live backend.
const client = {
  watchQuery: () => ({
    localQueryResult: () => undefined,
    subscribe: () => () => undefined,
  }),
} as unknown as Parameters<typeof ConvexProvider>[0]["client"];

const render = (open: boolean) =>
  renderToStaticMarkup(
    createElement(
      ConvexProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: ["/dashboard"] },
        createElement(
          Sidebar,
          { open, setOpen: () => undefined },
          createElement(DesktopSidebar, null, createElement(SidebarBrand, null)),
          createElement(MobileSidebar, null, createElement(SidebarBrand, null)),
          createElement(
            "nav",
            null,
            createElement(SidebarLink, { to: "/dashboard", label: "Dashboard", icon: createElement("i", null) }),
            createElement(SidebarLink, { to: "/clients", label: "Clients", icon: createElement("i", null) })
          ),
          createElement(SidebarAction, {
            label: "Dark Mode",
            icon: createElement("i", null),
            onClick: () => undefined,
          })
        )
      )
    )
  );

const expanded = render(true);
const collapsed = render(false);

const checks: [string, boolean][] = [
  // Expanded: every label is on screen.
  ["expanded shows the wordmark", expanded.includes("Evangelist")],
  ["expanded shows the portal caption", expanded.includes("Staff Portal")],
  ["expanded shows nav labels", expanded.includes(">Dashboard<") && expanded.includes(">Clients<")],
  ["expanded shows the footer action", expanded.includes(">Dark Mode<")],
  ["expanded keeps the links", expanded.includes('href="/clients"')],
  // Collapsed: the rail is icons only, and every icon still names itself.
  ["collapsed hides nav labels", !collapsed.includes(">Dashboard<")],
  ["collapsed hides the wordmark", !collapsed.includes("Staff Portal")],
  ["collapsed keeps the links", collapsed.includes('href="/clients"')],
  ["collapsed labels the row for hover", collapsed.includes('title="Dashboard"')],
  ["collapsed hides the footer label", !collapsed.includes(">Dark Mode<")],
  ["collapsed still marks the active route", collapsed.includes('aria-current="page"')],
];

let bad = 0;
for (const [label, ok] of checks) {
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
}
console.log(`  rail: ${SIDEBAR_RAIL}px collapsed -> ${SIDEBAR_WIDTH}px expanded`);
console.log(bad === 0 ? "\nStaff sidebar renders as expected." : `\n${bad} check(s) failed.`);

process.exit(bad === 0 ? 0 : 1);
