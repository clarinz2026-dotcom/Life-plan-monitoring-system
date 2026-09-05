import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { Button as ShadcnButton } from "@/components/ui/button";

const MOTTO = "To Care And To Serve!";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#faf8f3]">
      {/* ─── TopNav ─────────────────────────────────────────────────────── */}
      <header className="border-b border-[#d4d2cb] bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-9 w-9 rounded-lg" />
            <div>
              <span className="font-bold text-base tracking-tight text-[#1b4332]">
                Evangelist Funeral Services
              </span>
            </div>
          </div>
          <ShadcnButton
            size="sm"
            variant="secondary"
            className="gap-2 h-10 px-5 text-sm rounded-full font-medium"
            onClick={() => navigate("/auth")}
          >
            Sign In
          </ShadcnButton>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pb-12">
        {/* Soft background wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b4332]/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#e8e6df]/40 to-transparent pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 md:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Motto badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1b4332]/5 border border-[#1b4332]/10 mb-6 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#1b4332]" />
              <span className="text-sm font-medium text-[#1b4332]">
                {MOTTO}
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] text-[#1c1c1c] max-w-3xl">
              Pre-Need Deathcare Plan
              <br />
              <span className="text-[#1b4332]">Management System</span>
            </h1>

            <p className="text-base md:text-lg text-[#5a5a5a] mt-5 max-w-xl leading-relaxed">
              A complete, easy-to-use platform for tracking client contracts,
              recording daily payments, issuing receipts, and monitoring
              delinquency — built for funeral service teams that value simplicity
              and clarity.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-8">
              <ShadcnButton
                size="lg"
                className="h-11 px-8 text-base rounded-full font-medium gap-2"
                onClick={() => navigate("/auth")}
              >
                Get Started
                <span className="inline-block -rotate-45">→</span>
              </ShadcnButton>
              <p className="text-sm text-[#6b6b6b] flex items-center gap-1.5">
                <svg className="h-4 w-4 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Free for your team
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Motto Banner ───────────────────────────────────────────────── */}
      <section className="border-t border-[#d4d2cb] bg-[#1b4332]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-sm uppercase tracking-[0.2em] text-white/60 mb-3 font-medium">
              Our Corporate Motto
            </p>
            <p className="text-2xl md:text-3xl font-bold text-white italic leading-relaxed">
              “{MOTTO}”
            </p>
            <p className="text-sm text-white/50 mt-3 max-w-lg mx-auto">
              Every feature in this system is built to help your team care for
              families with dignity, and serve them with accuracy.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────────── */}
      <section className="border-t border-[#d4d2cb]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <p className="text-xs uppercase tracking-widest text-[#8a8a8a] mb-3 font-medium">
              What the system does
            </p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1c1c1c] mb-10">
              Everything your team needs, in one place
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                  ),
                  title: "Client Management",
                  desc: "Track all planholders, beneficiaries, and contract details in one searchable system.",
                },
                {
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M12 12h.01M6 12h.01M18 12h.01M8 16h8" />
                    </svg>
                  ),
                  title: "Payment Collection",
                  desc: "Record payments via Cash, GCash, Maya, Bank Transfer, or Check — with full history.",
                },
                {
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  ),
                  title: "Auto Receipts",
                  desc: "Official receipts generated instantly with every payment recorded — print or export anytime.",
                },
                {
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                      <path d="M12 15v4M6 21h12" />
                    </svg>
                  ),
                  title: "Role-Based Access",
                  desc: "CEO, Manager, Finance Staff, and Cashier — each with exactly the access they need.",
                },
                {
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3v18h18" />
                      <path d="M18 17V9M13 17V5M8 17v-3" />
                    </svg>
                  ),
                  title: "Reports & Aging",
                  desc: "View collections, aging reports, reconciliation summaries, and export everything to Excel.",
                },
                {
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  ),
                  title: "Bulk Upload",
                  desc: "Import dozens of planholders at once from a CSV or Excel file — no data entry fatigue.",
                },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  viewport={{ once: true }}
                >
                  <div className="bg-white rounded-xl border border-[#d4d2cb] p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-10 w-10 rounded-lg bg-[#1b4332]/5 flex items-center justify-center mb-4 text-[#1b4332]">
                      {f.icon}
                    </div>
                    <h3 className="text-lg font-bold text-[#1c1c1c] mb-1.5">{f.title}</h3>
                    <p className="text-sm text-[#6b6b6b] leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Trust / About snippet ───────────────────────────────────────── */}
      <section className="border-t border-[#d4d2cb] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-[#8a8a8a] mb-3 font-medium">
                Who this is for
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-[#1c1c1c] mb-4 leading-tight">
                Built for funeral service teams
                <br />
                who work with care every day
              </h2>
              <p className="text-base text-[#6b6b6b] leading-relaxed">
                From the CEO tracking overall collections, to the cashier
                recording today's payments — every role sees a clean, readable
                screen designed for real daily use, not for screenshots.
              </p>
              <p className="text-base text-[#6b6b6b] leading-relaxed mt-3">
                Large fonts, clear buttons, and simple language. No terminal,
                no code, no confusion.
              </p>
            </div>
            <div className="bg-[#f5f5f0] rounded-xl border border-[#d4d2cb] p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-[#1b4332] flex items-center justify-center shrink-0 text-white font-bold text-lg">
                  E
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-[#1b4332] font-medium mb-1">
                    From the team
                  </p>
                  <p className="text-base italic text-[#3a3a3a] leading-relaxed">
                    “We built this so that anyone in our office — at any age, on
                    any day — can open a screen and know exactly what to do.”
                  </p>
                  <p className="text-sm text-[#8a8a8a] mt-2">
                    Evangelist Funeral Services
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[#d4d2cb]">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <p className="text-xs uppercase tracking-widest text-[#8a8a8a] mb-3 font-medium">
              Ready to begin
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-[#1c1c1c] mb-3">
              Start managing plans with care
            </h2>
            <p className="text-sm text-[#6b6b6b] max-w-md mx-auto mb-8 leading-relaxed">
              Sign in to access your dashboard, record today's payments, and
              keep your team on the same page.
            </p>
            <ShadcnButton
              size="lg"
              className="h-11 px-8 text-base rounded-full font-medium gap-2"
              onClick={() => navigate("/auth")}
            >
              Sign In to Dashboard
              <span className="inline-block -rotate-45">→</span>
            </ShadcnButton>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#d4d2cb] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-[#8a8a8a]">
          <p>
            <span className="font-medium text-[#5a5a5a]">Evangelist Funeral Services</span>
            {" "}·{" "}
            {MOTTO}
          </p>
          <p className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292c.3.921-.751 1.603-1.547 1.603H6.636c-1.437 0-2.158-.475-2.158-1.603l.085-1.733 3.47-3.47A1.5 1.5 0 0112 5.056a1.5 1.5 0 012.436 1.07l3.47 3.47H16.26c0 1.124-.778 1.603-1.774 1.603a33 33 0 00-2.945-.085L9.049 2.927z" />
            </svg>
            Pre-Need Deathcare Plan Management
          </p>
        </div>
      </footer>
    </div>
  );
}
