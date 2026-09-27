import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { BrandLogo } from "@/components/BrandLogo";
import { useQuery } from "convex/react";
import { ArrowRight, Loader2, LogOut, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

/** Roles that may open the staff area (mirrors src/convex/roles.ts). */
const STAFF_ROLES = [
  "super_admin",
  "ceo",
  "manager",
  "finance_staff",
  "cashier",
];

function Auth() {
  const {
    isLoading: authLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = useQuery(api.users.hasSuperAdmin);

  // Route staff to the management dashboard and everyone else to the client
  // portal. An explicit returnTo (deep link to a protected page) wins.
  const returnTo = searchParams.get("returnTo");
  const landing =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : null;

  // `currentUser` keeps returning `null` for a beat after sign-in — the cached
  // result for the signed-out session is served until the new identity lands.
  // That `null` is indistinguishable from "signed in with no role", so routing
  // on it dropped staff accounts straight into the client portal. Wait for the
  // real user document before deciding where anyone goes.
  const userLoaded = user !== undefined && user !== null;
  const awaitingSession =
    isAuthenticated && (!userLoaded || setup === undefined);

  // `?as=staff` marks a visit that started from a "Staff & agents — sign in"
  // entry point. Those visitors must reach the management dashboard or be told
  // why they can't — never be quietly dropped into the client portal.
  const staffIntent = searchParams.get("as") === "staff";
  const userRole = user?.role ?? null;
  const userIsStaff = userRole !== null && STAFF_ROLES.includes(userRole);
  // A brand-new install has no Super Admin yet; its first account is routed to
  // setup rather than being told it isn't staff.
  const firstRun = setup !== undefined && setup.hasSuperAdmin === false;
  const notStaffAccount =
    staffIntent &&
    isAuthenticated &&
    userLoaded &&
    !userIsStaff &&
    !firstRun;

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!userLoaded || setup === undefined) return;
    if (landing) {
      navigate(landing);
      return;
    }
    // Role holders and the very first account (before a Super Admin exists)
    // go to the staff dashboard/setup flow. Everyone else lands in the portal.
    if (userIsStaff || setup.hasSuperAdmin === false) {
      navigate("/dashboard");
      return;
    }
    // Staff intent: stay on this page and explain, instead of bouncing a
    // non-staff account into the client portal.
    if (staffIntent) return;
    navigate("/portal/plans");
  }, [
    authLoading,
    isAuthenticated,
    userLoaded,
    userIsStaff,
    staffIntent,
    setup,
    landing,
    navigate,
  ]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("send_otp") || msg.includes("network") || msg.includes("fetch")) {
        setError("Could not send verification email. Please check your connection and try again.");
      } else {
        setError(msg || "Failed to send verification code. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  // Let a visitor drop the current (non-staff) session so they can sign in with
  // the work email that actually holds their role.
  const handleSwitchAccount = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsLoading(false);
      setStep("signIn");
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to sign in as guest. Please try again."
      );
      setIsLoading(false);
    }
  };

  // Hold the card while the fresh session loads, so someone who just entered
  // their code does not briefly see the sign-in form again.
  if (awaitingSession) {
    return (
      <div className="staff-shell flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm font-mono text-muted-foreground">
          Signing you in…
        </p>
      </div>
    );
  }

  // Came from "Staff & agents — sign in" but this account holds no staff
  // role. Explain that instead of redirecting into the client portal.
  if (notStaffAccount) {
    return (
      <div className="staff-shell flex min-h-screen flex-col bg-background">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="flex items-center justify-center h-full flex-col w-full max-w-[420px]">
            <Card className="w-full border shadow-md">
              <CardHeader className="text-center">
                <div className="flex justify-center">
                  <BrandLogo
                    className="h-14 w-14 rounded-[9px] ring-1 ring-black/10 mb-3 mt-3 cursor-pointer"
                    onClick={() => navigate("/")}
                    title="Evangelist Funeral Services"
                  />
                </div>
                <p className="font-brayles text-[17px] leading-none text-blue-800">
                  Evangelist
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone">
                  Staff portal
                </p>
                <CardTitle className="text-xl font-mono mt-1">
                  <span className="text-destructive">&gt;</span> Not a staff
                  account
                </CardTitle>
                <CardDescription>
                  <span className="font-mono text-foreground">
                    {user?.email ?? "This account"}
                  </span>{" "}
                  isn&apos;t registered as office staff.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-6">
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  Ask your Super Admin or CEO to set your role — or assign you a
                  branch position (Branch Manager, Collector, or Cashier) — then
                  sign in again.
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={handleSwitchAccount}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Sign in with a different account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate("/portal/plans")}
                >
                  Go to my client portal
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-shell flex min-h-screen flex-col bg-background">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="flex items-center justify-center h-full flex-col w-full max-w-[400px]">
          <Card className="w-full pb-0 border shadow-md">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <div className="flex justify-center">
                    <BrandLogo
                      className="h-14 w-14 rounded-[9px] ring-1 ring-black/10 mb-3 mt-3 cursor-pointer"
                      onClick={() => navigate("/")}
                      title="Evangelist Funeral Services"
                    />
                  </div>
                  <p className="font-brayles text-[17px] leading-none text-blue-800">
                    Evangelist
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone">
                    {staffIntent ? "Staff portal" : "Client portal"}
                  </p>
                  <CardTitle className="text-xl font-mono mt-1">
                    <span className="text-terminal-green">&gt;</span>{" "}
                    {staffIntent ? "Staff Sign In" : "Get Started"}
                  </CardTitle>
                  <CardDescription>
                    {staffIntent
                      ? "Enter your work email to open the management dashboard"
                      : "Enter your email to log in or sign up"}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="pl-9 font-mono text-sm"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-destructive">{error}</p>
                    )}

                    <div className="mt-4">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            Or
                          </span>
                        </div>
                      </div>

                      {staffIntent ? (
                        <p className="mt-4 text-center text-xs text-muted-foreground">
                          Looking for your plan?{" "}
                          <button
                            type="button"
                            className="underline transition-colors hover:text-foreground"
                            onClick={() => navigate("/auth?returnTo=%2Fportal%2Fplans")}
                          >
                            Open the client portal
                          </button>
                        </p>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full mt-4 gap-2"
                          onClick={handleGuestLogin}
                          disabled={isLoading}
                        >
                          <UserX className="h-4 w-4" />
                          Continue as guest (client portal)
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center mt-3">
                  <CardTitle className="font-mono text-lg">
                    Check your email
                  </CardTitle>
                  <CardDescription>
                    We&apos;ve sent a code to{" "}
                    <span className="font-mono text-foreground">{step.email}</span>
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-destructive text-center">
                        {error}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      Didn&apos;t receive a code?{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => {
                          setStep("signIn");
                          setError(null);
                          setOtp("");
                        }}
                      >
                        Try again
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full font-mono"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setStep("signIn");
                        setError(null);
                        setOtp("");
                      }}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Use different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            <div className="py-3 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
              Secured by{" "}
              <a
                href="https://freebuff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary transition-colors"
              >
                freebuff.com
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <Auth />
    </Suspense>
  );
}
