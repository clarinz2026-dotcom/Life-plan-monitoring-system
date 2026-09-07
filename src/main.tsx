import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import AppLayout from "@/components/AppLayout";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Clients = lazy(() => import("./pages/Clients.tsx"));
const ClientDetail = lazy(() => import("./pages/ClientDetail.tsx"));
const Contracts = lazy(() => import("./pages/Contracts.tsx"));
const Payments = lazy(() => import("./pages/Payments.tsx"));
const Receipts = lazy(() => import("./pages/Receipts.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const AuditLog = lazy(() => import("./pages/AuditLog.tsx"));
const BulkUpload = lazy(() => import("./pages/BulkUpload.tsx"));
const Plans = lazy(() => import("./pages/Plans.tsx"));
const Reconciliation = lazy(() => import("./pages/Reconciliation.tsx"));
const DeathClaims = lazy(() => import("./pages/DeathClaims.tsx"));
const AgingReport = lazy(() => import("./pages/AgingReport.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const ExportData = lazy(() => import("./pages/ExportData.tsx"));
const RoleManagement = lazy(() => import("./pages/RoleManagement.tsx"));
const Branding = lazy(() => import("./pages/Branding.tsx"));
const SuperAdminSetup = lazy(() => import("./pages/SuperAdminSetup.tsx"));
const ServiceRequests = lazy(() => import("./pages/ServiceRequests.tsx"));
const Branches = lazy(() => import("./pages/Branches.tsx"));
const PortalLayout = lazy(() => import("./pages/portal/PortalLayout.tsx"));
const PortalOverview = lazy(() => import("./pages/portal/Overview.tsx"));
const PortalPlans = lazy(() => import("./pages/portal/Plans.tsx"));
const PortalServices = lazy(() => import("./pages/portal/Services.tsx"));
const PortalChapels = lazy(() => import("./pages/portal/Chapels.tsx"));
const PortalHelp = lazy(() => import("./pages/portal/Help.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground font-mono text-sm">
        Loading...
      </div>
    </div>
  );
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

/** Wrapper that adds AppLayout around protected page content */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
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
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage />} />

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
                path="/death-claims"
                element={
                  <ProtectedRoute>
                    <DeathClaims />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/service-requests"
                element={
                  <ProtectedRoute>
                    <ServiceRequests />
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
                path="/export"
                element={
                  <ProtectedRoute>
                    <ExportData />
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
                path="/branding"
                element={
                  <ProtectedRoute>
                    <Branding />
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

              {/* Client portal (families & planholders) */}
              <Route
                path="/portal"
                element={
                  <RequireAuth>
                    <PortalLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<PortalOverview />} />
                <Route path="plans" element={<PortalPlans />} />
                <Route path="services" element={<PortalServices />} />
                <Route path="chapels" element={<PortalChapels />} />
                <Route path="help" element={<PortalHelp />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>
);
