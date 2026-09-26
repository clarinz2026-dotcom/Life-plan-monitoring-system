import type { AuthConfig } from "convex/server";

/**
 * This deployment is self-contained: the only way in is this app's own sign-in
 * (the email OTP provider, see ./auth/emailOtp.ts).
 *
 * The single provider is the deployment's own OIDC issuer (iss =
 * CONVEX_SITE_URL, no `kid` header), validated via OIDC discovery at
 * `${domain}/.well-known/openid-configuration` and served by
 * auth.addHttpRoutes() in convex/http.ts.
 *
 * Do NOT convert this to `type: "customJwt"` — that path rejects tokens without
 * a `kid` header, so sign-in would silently never confirm and RequireAuth would
 * loop back to /auth forever.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
