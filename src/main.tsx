import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import CookieNotice from "@/components/CookieNotice";
import { RequireAuth } from "@/components/RequireAuth";
import { BranchScopeProvider } from "@/hooks/use-branch";
import { RouteProgress } from "@/components/RouteProgress";
import { PageLoading } from "@/components/PageLoading";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import "./index.css";

import Landing from "./pages/Landing.tsx";

/**
 * The staff shell only renders inside protected routes, so it is code-split
 * like every page: the landing page (the boot path for most visitors) no
 * longer parses it before first paint.
 */
const AppLayout = lazy(() => import("@/components/AppLayout"));

// Landing is imported eagerly: it is the entry point for almost every visitor,
// and lazy-loading it meant the browser had to finish parsing the app bundle
// before it even requested the hero markup and images (an extra round trip
// before paint). Every other route is lazily code-split:
/*
 * Route modules are fetched by URL, and dev-server restarts or dependency
 * re-optimizations invalidate those URLs. A request made against an old URL
 * rejects with "Failed to fetch dynamically imported module" and, without a
 * retry, left the preview stuck on the error panel until a manual refresh.
 *
 * Retry once (the server has usually finished re-optimizing by then) and, if it
 * still fails, reload the page once so the router picks up fresh URLs. The
 * reload is guarded per route and skipped entirely when storage is unavailable
 * (framed contexts can block it), so it can never loop.
 */
const RELOAD_FLAG = "evangelist:route-reload";
const routeStorage = (() => {
  try {
    const probe = "__storage_probe__";
    window.sessionStorage.setItem(probe, "1");
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
})();

function loadRoute<T>(name: string, load: () => Promise<T>): Promise<T> {
  return load().then(
    (mod) => {
      routeStorage?.removeItem(RELOAD_FLAG);
      return mod;
    },
    async () => {
      // A short pause is enough for the dev server to finish re-optimizing deps.
      await new Promise((resolve) => setTimeout(resolve, 350));
      try {
        const mod = await load();
        routeStorage?.removeItem(RELOAD_FLAG);
        return mod;
      } catch (secondError) {
        // Still failing: the import graph itself is stale. Without storage we
        // cannot prove we have not already reloaded, so surface the error rather
        // than risk a reload loop.
        if (!routeStorage || routeStorage.getItem(RELOAD_FLAG) === name) {
          throw secondError;
        }
        routeStorage.setItem(RELOAD_FLAG, name);
        window.location.reload();
        // The page is unloading; keep Suspense showing its fallback meanwhile.
        return new Promise<never>(() => {});
      }
    }
  );
}

/** `lazy()` wired to the resilient loader above. */
function lazyRoute<T extends React.ComponentType<any>>(
  name: string,
  load: () => Promise<{ default: T }>
) {
  return lazy(() => loadRoute(name, load));
}

const AuthPage = lazyRoute("Auth", () => import("./pages/Auth.tsx"));
const Dashboard = lazyRoute("Dashboard", () => import("./pages/Dashboard.tsx"));
const MyBranch = lazyRoute("MyBranch", () => import("./pages/MyBranch.tsx"));
const Clients = lazyRoute("Clients", () => import("./pages/Clients.tsx"));
const ClientDetail = lazyRoute("ClientDetail", () => import("./pages/ClientDetail.tsx"));
const Contracts = lazyRoute("Contracts", () => import("./pages/Contracts.tsx"));
const Payments = lazyRoute("Payments", () => import("./pages/Payments.tsx"));
const Receipts = lazyRoute("Receipts", () => import("./pages/Receipts.tsx"));
const Reports = lazyRoute("Reports", () => import("./pages/Reports.tsx"));
const AuditLog = lazyRoute("AuditLog", () => import("./pages/AuditLog.tsx"));
const BulkUpload = lazyRoute("BulkUpload", () => import("./pages/BulkUpload.tsx"));
const Plans = lazyRoute("Plans", () => import("./pages/Plans.tsx"));
const Reconciliation = lazyRoute("Reconciliation", () => import("./pages/Reconciliation.tsx"));
const ORSeries = lazyRoute("ORSeries", () => import("./pages/ORSeries.tsx"));
const LPASeries = lazyRoute("LPASeries", () => import("./pages/LPASeries.tsx"));
const CollectorTargets = lazyRoute("CollectorTargets", () => import("./pages/CollectorTargets.tsx"));
const AgingReport = lazyRoute("AgingReport", () => import("./pages/AgingReport.tsx"));
const Notifications = lazyRoute("Notifications", () => import("./pages/Notifications.tsx"));
const RoleManagement = lazyRoute("RoleManagement", () => import("./pages/RoleManagement.tsx"));
const Branding = lazyRoute("Branding", () => import("./pages/Branding.tsx"));
const ApiIntegration = lazyRoute("ApiIntegration", () => import("./pages/ApiIntegration.tsx"));
const SuperAdminSetup = lazyRoute("SuperAdminSetup", () => import("./pages/SuperAdminSetup.tsx"));
const AccountLinks = lazyRoute("AccountLinks", () => import("./pages/AccountLinks.tsx"));
const Branches = lazyRoute("Branches", () => import("./pages/Branches.tsx"));
const PortalLayout = lazyRoute("PortalLayout", () => import("./pages/portal/PortalLayout.tsx"));
const PortalPlans = lazyRoute("PortalPlans", () => import("./pages/portal/Plans.tsx"));
const PortalLinkAccount = lazyRoute("PortalLinkAccount", () => import("./pages/portal/LinkAccount.tsx"));
const SystemDeck = lazyRoute("SystemDeck", () => import("./pages/SystemDeck.tsx"));
const NotFound = lazyRoute("NotFound", () => import("./pages/NotFound.tsx"));

// Public policy pages. A planholder asking what we do with their data should
// not have to sign in to find out, so none of these sit behind RequireAuth.
const Privacy = lazyRoute("LegalPrivacy", () => import("./pages/legal/Privacy.tsx"));
const Terms = lazyRoute("LegalTerms", () => import("./pages/legal/Terms.tsx"));
const Refunds = lazyRoute("LegalRefunds", () => import("./pages/legal/Refunds.tsx"));
const Cookies = lazyRoute("LegalCookies", () => import("./pages/legal/Cookies.tsx"));
const Accessibility = lazyRoute("LegalAccessibility", () => import("./pages/legal/Accessibility.tsx"));
const PrivacyRequest = lazyRoute("PrivacyRequest", () => import("./pages/legal/PrivacyRequest.tsx"));
const PrivacyRequests = lazyRoute("PrivacyRequests", () => import("./pages/PrivacyRequests.tsx"));

/**
 * Fallback while a lazily-loaded route chunk is in flight. The Suspense boundary
 * sits inside `ConvexAuthProvider`, so the shared loading state (and the brand
 * mark it reads the configured logo for) can mount here.
 */
function RouteLoading() {
  return <PageLoading label="Loading" className="min-h-screen" />;
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold font-mono">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

/**
 * Warm the chunks behind the main calls to action while the browser is idle, so
 * the first navigation into sign-in or the dashboard does not wait on a fetch.
 */
function prefetchPrimaryRoutes() {
  for (const load of [
    () => import("./pages/Auth.tsx"),
    () => import("./pages/Dashboard.tsx"),
    () => import("./pages/portal/Plans.tsx"),
  ]) {
    load().catch(() => {
      /* prefetch is best-effort — the route still loads on demand */
    });
  }
}

if (typeof window !== "undefined") {
  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(prefetchPrimaryRoutes, { timeout: 2500 });
  } else {
    window.setTimeout(prefetchPrimaryRoutes, 500);
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*"
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/**
 * Wrapper that adds AppLayout around protected page content.
 *
 * `BranchScopeProvider` sits outside AppLayout so the shell itself (the
 * header's `[ ALL BRANCHES ▼ ]` control) and every page inside it read the same
 * Head Office branch scope.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <BranchScopeProvider>
        <AppLayout>{children}</AppLayout>
      </BranchScopeProvider>
    </RequireAuth>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <RouteProgress />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage />} />
              {/* Proposal deck. Public on purpose: it is opened from whatever
                  device is being used to present, and carries no client data. */}
              <Route path="/deck" element={<SystemDeck />} />

              {/* Policies and the data request form — public on purpose. */}
              <Route path="/legal/privacy" element={<Privacy />} />
              <Route path="/legal/terms" element={<Terms />} />
              <Route path="/legal/refunds" element={<Refunds />} />
              <Route path="/legal/cookies" element={<Cookies />} />
              <Route path="/legal/accessibility" element={<Accessibility />} />
              <Route path="/privacy-request" element={<PrivacyRequest />} />

              {/* Protected routes with AppLayout */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-branch"
                element={
                  <ProtectedRoute>
                    <MyBranch />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <ProtectedRoute>
                    <Clients />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clients/:clientId"
                element={
                  <ProtectedRoute>
                    <ClientDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contracts"
                element={
                  <ProtectedRoute>
                    <Contracts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payments"
                element={
                  <ProtectedRoute>
                    <Payments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/receipts"
                element={
                  <ProtectedRoute>
                    <Receipts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit"
                element={
                  <ProtectedRoute>
                    <AuditLog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bulk-upload"
                element={
                  <ProtectedRoute>
                    <BulkUpload />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plans"
                element={
                  <ProtectedRoute>
                    <Plans />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reconciliation"
                element={
                  <ProtectedRoute>
                    <Reconciliation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/or-series"
                element={
                  <ProtectedRoute>
                    <ORSeries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lpa-series"
                element={
                  <ProtectedRoute>
                    <LPASeries />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collector-targets"
                element={
                  <ProtectedRoute>
                    <CollectorTargets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/account-links"
                element={
                  <ProtectedRoute>
                    <AccountLinks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/branches"
                element={
                  <ProtectedRoute>
                    <Branches />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/aging-report"
                element={
                  <ProtectedRoute>
                    <AgingReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/role-management"
                element={
                  <ProtectedRoute>
                    <RoleManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin-setup"
                element={
                  <ProtectedRoute>
                    <SuperAdminSetup />
                  </ProtectedRoute>
                }
              />
              {/* Branding editor is back (app logo management); the generic
                  export dump stays retired. Its URL still resolves to NotFound
                  rather than a blank page. */}
              <Route
                path="/branding"
                element={
                  <ProtectedRoute>
                    <Branding />
                  </ProtectedRoute>
                }
              />
              {/* API Integration: key management for external read-only
                  access. Super Admin only — the page itself also gates, so a
                  hand-typed URL shows the shield notice rather than data. */}
              <Route
                path="/privacy-requests"
                element={
                  <ProtectedRoute>
                    <PrivacyRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/api-integration"
                element={
                  <ProtectedRoute>
                    <ApiIntegration />
                  </ProtectedRoute>
                }
              />
              <Route path="/export" element={<NotFound />} />

              {/* Client portal (families & planholders) */}
              <Route
                path="/portal"
                element={
                  <RequireAuth>
                    <PortalLayout />
                  </RequireAuth>
                }
              >
                {/* The portal's landing page is the plans/payments statement,
                    so the index redirects instead of rendering a separate
                    overview screen. */}
                <Route index element={<Navigate to="/portal/plans" replace />} />
                <Route path="plans" element={<PortalPlans />} />
                <Route path="link-account" element={<PortalLinkAccount />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          {/* CookieNotice renders a react-router <Link> to the cookie policy,
              so it must be a descendant of BrowserRouter — mounted beside the
              router it crashed the whole app on first paint with
              "Cannot destructure property 'basename' of useContext(...) as it
              is null". It sits outside <Suspense> so a slow route chunk never
              takes the notice down with it. */}
          <CookieNotice />
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>
);
