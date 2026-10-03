import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { Link, NavLink } from "react-router";
import {
  COMPANY,
  DATA_REQUEST_PATH,
  LEGAL_DOCS,
  POLICY_LAST_UPDATED,
} from "@/lib/legal";

/**
 * Shared frame for every policy page: a document column, a sticky index of the
 * other policies, and the office's business details (which the law expects to
 * be findable on the page, not buried).
 *
 * Policies are public and reachable without an account — a planholder asking
 * what we do with their data should not have to sign in to find out.
 */
export default function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      <a
        href="#policy-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-evergreen focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-bold focus:text-white"
      >
        Skip to the policy text
      </a>

      <header className="border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link to="/" className="flex items-center gap-3" aria-label="Evangelist Funeral Services — home">
            <BrandLogo className="h-9 w-9 rounded-[9px] shadow-sm ring-1 ring-black/10" />
            <span className="hidden leading-tight sm:block">
              <span className="font-brayles block text-[18px] leading-tight text-blue-800">
                Evangelist
              </span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-stone">
                {title}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button
                variant="outline"
                className="h-10 gap-2 rounded-full border-evergreen/25 px-5 text-[13.5px] font-bold text-evergreen hover:bg-evergreen hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to the site
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main
        id="policy-content"
        className="mx-auto grid max-w-[1180px] gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-10 lg:py-16"
      >
        <article className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-gold">
            {COMPANY.legalName}
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-evergreen lg:text-[42px]">
            {title}
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-stone">{intro}</p>
          <p className="mt-4 text-[13px] text-stone">
            <span className="font-semibold text-ink">Last updated:</span>{" "}
            {POLICY_LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-10">{children}</div>
        </article>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <nav aria-label="Policies" className="rounded-2xl border border-line bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
              Our policies
            </p>
            <ul className="mt-4 space-y-2.5">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.to}>
                  <NavLink
                    to={doc.to}
                    className={({ isActive }) =>
                      `flex items-start gap-2 rounded-lg px-2 py-1.5 text-[14px] font-semibold transition-colors ${
                        isActive
                          ? "bg-evergreen/8 text-evergreen"
                          : "text-ink/75 hover:bg-cream hover:text-evergreen"
                      }`
                    }
                  >
                    {doc.title}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink
                  to={DATA_REQUEST_PATH}
                  className={({ isActive }) =>
                    `flex items-start gap-2 rounded-lg px-2 py-1.5 text-[14px] font-semibold transition-colors ${
                      isActive
                        ? "bg-evergreen/8 text-evergreen"
                        : "text-ink/75 hover:bg-cream hover:text-evergreen"
                    }`
                  }
                >
                  Make a data request
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="mt-5 rounded-2xl border border-line bg-cream p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
              Business details
            </p>
            <p className="mt-3 text-[14px] font-bold text-ink">
              {COMPANY.legalName}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-stone">
              {COMPANY.business}
            </p>
            <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-ink/85">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-evergreen" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{COMPANY.mainOffice.label}</span>
                  <br />
                  {COMPANY.mainOffice.lines[0]}
                  <br />
                  {COMPANY.mainOffice.lines[1]}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-evergreen" aria-hidden="true" />
                <a
                  href={`tel:${COMPANY.hotline.replace(/\s/g, "")}`}
                  className="underline underline-offset-2 hover:text-evergreen"
                >
                  {COMPANY.hotline}
                </a>{" "}
                <span className="text-stone">(24/7 for active plans)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-evergreen" aria-hidden="true" />
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="break-all underline underline-offset-2 hover:text-evergreen"
                >
                  {COMPANY.email}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-evergreen" aria-hidden="true" />
                <span>{COMPANY.officeHours}</span>
              </li>
            </ul>
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
              Talk to a person
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-stone">
              Questions about this policy? Visit any branch, or call the main
              office. If you have asked us something and not heard back within
              fifteen days, call again and ask for the manager.
            </p>
            <a
              href={`mailto:${COMPANY.email}?subject=Privacy%20question`}
              className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-evergreen underline underline-offset-2"
            >
              Email the office
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </aside>
      </main>

      <footer className="border-t border-line bg-pine py-8 text-white/75">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-4 text-[12.5px] sm:px-6 lg:flex-row lg:px-10"><p>
              © 2026 {COMPANY.legalName} All rights reserved.
            </p>
          <nav aria-label="Policies (footer)">
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.to}>
                  <Link to={doc.to} className="transition-colors hover:text-gold-soft">
                    {doc.short}
                  </Link>
                </li>
              ))}
              <li>
                <Link to={DATA_REQUEST_PATH} className="transition-colors hover:text-gold-soft">
                  Data request
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** A titled block inside a policy. */
export function PolicySection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-[22px] font-semibold text-evergreen lg:text-[26px]">
        {heading}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-stone">
        {children}
      </div>
    </section>
  );
}