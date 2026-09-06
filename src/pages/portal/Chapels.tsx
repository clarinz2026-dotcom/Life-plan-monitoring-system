import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Clock,
  Compass,
  Landmark,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Video,
} from "lucide-react";
import { Link } from "react-router";
import { Card, EmptyState, PortalShell } from "./shared";

const ESERVICES = [
  {
    icon: Video,
    title: "eBurol — Online Wake Viewing",
    desc: "Watch a wake at our chapels live, 24/7, from anywhere in the world. Request viewing access and our staff will set it up for you.",
    cta: "Request eBurol access",
    to: "/portal/services?type=eburol_access",
  },
  {
    icon: Compass,
    title: "Virtual Tour",
    desc: "Take a walk through our chapels, viewing halls, and family lounges from our public website.",
    cta: "See the virtual tour",
    to: "/#eservices",
    external: true,
  },
  {
    icon: ShoppingCart,
    title: "Online Store & Buy Now",
    desc: "Buy a Life Plan or memorial items online — pay via GCash, Maya, or card with a plan officer's help.",
    cta: "Buy plans & memorial items",
    to: "/portal/services?type=plan_purchase",
  },
  {
    icon: ShieldCheck,
    title: "Why families trust us",
    desc: "Members of ICCFA, NFDA, and CANA, with DTI-registered online business and clearly stated, guaranteed service.",
    cta: "Talk to a plan officer",
    to: "/portal/services?type=plan_purchase",
  },
];

export default function Chapels() {
  const branches = useQuery(api.branches.list);
  const active = (branches ?? []).filter((b) => b.isActive !== false);

  return (
    <div className="space-y-12">
      <PortalShell
        title="Chapels & Store Locator"
        subtitle="Find the Evangelist chapel, branch office, or accredited agent nearest you — every location is open 24/7 for memorial services."
      />

      {/* eServices cards */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-evergreen">
          eServices
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ESERVICES.map((s) => (
            <Card key={s.title} className="flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-evergreen text-white">
                <s.icon className="h-[22px] w-[22px]" />
              </span>
              <h3 className="mt-4 text-[15px] font-bold leading-snug text-ink">
                {s.title}
              </h3>
              <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-stone">
                {s.desc}
              </p>
              {"external" in s && s.external ? (
                <a
                  href={s.to}
                  className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-evergreen transition-colors hover:text-gold"
                >
                  {s.cta} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <Link
                  to={s.to}
                  className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-evergreen transition-colors hover:text-gold"
                >
                  {s.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Branches */}
      <section id="branches" className="scroll-mt-24">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold text-evergreen">
            Our chapels & offices
          </h2>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-stone">
            <Clock className="h-3.5 w-3.5 text-gold" /> Open 24/7, including holidays
          </p>
        </div>

        {branches === undefined ? (
          <Card className="grid min-h-[200px] place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-evergreen" />
          </Card>
        ) : active.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No branch records listed yet"
            subtitle="Branch details are managed by the office. Call our 24/7 hotline and we’ll gladly point you to the nearest Evangelist chapel."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {active.map((b) => (
              <Card key={b._id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-evergreen/8 text-evergreen">
                    <Landmark className="h-[22px] w-[22px]" />
                  </span>
                  <span className="rounded-full bg-evergreen/6 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-evergreen">
                    Open 24/7
                  </span>
                </div>
                <h3 className="mt-4 text-[16px] font-bold text-ink">{b.name}</h3>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                  {b.code}
                </p>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-stone">
                  {b.address}
                  <br />
                  {b.city}, {b.province}
                </p>
                {b.managerName && (
                  <p className="mt-2 text-[11.5px] text-stone">
                    Branch manager: <strong className="text-ink">{b.managerName}</strong>
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3.5">
                  <a
                    href={`tel:${(b.contactNumber ?? "").replace(/[^+\d]/g, "")}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-evergreen px-3.5 py-2 text-[12px] font-bold text-white transition-colors hover:bg-moss"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {b.contactNumber ?? "Call branch"}
                  </a>
                  <span className="ml-auto text-[11px] text-stone">
                    Memorial services & embalming
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* At-need strip */}
      <div className="rounded-3xl bg-pine px-6 py-8 text-white lg:px-10">
        <div className="flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gold-soft">
              In an emergency?
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold leading-snug">
              We are always awake so you don’t have to be.
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">
              Call any time — our chapel staff handle transport, embalming,
              documentation guidance, and wake setup 24 hours a day, 365 days a
              year.
            </p>
          </div>
          <a
            href="tel:+63287000000"
            className="inline-flex items-center gap-3 rounded-2xl bg-gold px-7 py-4 text-[16px] font-bold text-pine transition-transform hover:scale-[1.02]"
          >
            <Phone className="h-5 w-5" />
            (02) 8-700-0000
          </a>
        </div>
      </div>
    </div>
  );
}
