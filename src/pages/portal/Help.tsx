import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Clock,
  FileText,
  HeartHandshake,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { Card, PortalShell } from "./shared";

const CONTACTS = [
  {
    icon: Phone,
    title: "24/7 Hotline",
    line1: "(02) 8-700-0000",
    line2: "Globe 0917 000 0000 · Smart 0918 000 0000",
    href: "tel:+63287000000",
    cta: "Call now",
  },
  {
    icon: Mail,
    title: "Email",
    line1: "care@evangelistfuneral.com",
    line2: "Replies within 1 business day",
    href: "mailto:care@evangelistfuneral.com",
    cta: "Send an email",
  },
  {
    icon: Clock,
    title: "Office hours",
    line1: "Mon – Sat, 8:00 AM – 5:00 PM",
    line2: "Memorial chapels open 24/7, including holidays",
    href: "/portal/chapels",
    cta: "Find a chapel",
    internal: true,
  },
  {
    icon: MapPin,
    title: "Main office (Malaybalay)",
    line1: "2nd Floor, Gabrinez Bldg, Fortich St.,",
    line2: "Malaybalay City, Bukidnon 8700",
    href: "/portal/chapels",
    cta: "Store locator",
    internal: true,
  },
];

const FAQS = [
  {
    q: "Where and how can I pay my monthly installment?",
    a: "You can pay in cash at any Evangelist chapel or office, or through GCash, Maya, bank transfer, and check. Keep your contract number handy so our cashier can credit your account instantly. If you prefer to pay online, request payment assistance in the Services tab and we'll send you the exact account details.",
  },
  {
    q: "What happens if I miss a payment?",
    a: "Installments are tracked against your schedule. Accounts 30 days or more past due are flagged as delinquent, which may affect the benefits you can use. Pay as soon as you can — our team is glad to help you catch up, restructure terms, or settle a past-due balance before status worsens.",
  },
  {
    q: "Can I change my beneficiary or update my details?",
    a: "Yes. Beneficiary changes and contact/address updates are processed at any branch office with a valid ID. You can also file a change request through the Services tab and our staff will prepare the forms for you.",
  },
  {
    q: "How do I use eBurol to watch a wake online?",
    a: "eBurol is our 24/7 online wake viewing service. When a wake is held in an eBurol-equipped room, request access through the Services tab (or ask the chapel staff on site) and we'll send you a private viewing link and access code.",
  },
  {
    q: "What does my Life Plan cover at the time of need?",
    a: "Coverage depends on your plan type — traditionally it includes the use of a memorial chapel for the wake, embalming and preparation, funeral rites, and procession/hearse services. When the time comes, call our 24/7 hotline and give your contract number; our staff handle the rest.",
  },
  {
    q: "How do I get a copy of my official receipts or Statement of Account?",
    a: "Your receipts and payment history are always visible under My Plans. For a certified copy or a full Statement of Account by email, submit a 'Receipt / SOA Copy' request in the Services tab and we'll send it within a few business days.",
  },
];

const GUIDANCE = [
  {
    icon: Phone,
    title: "First call, first steps",
    text: "Call our 24/7 hotline. Give your contract number and the location of the deceased — we dispatch a team, guide documentation, and prepare the chapel room.",
  },
  {
    icon: FileText,
    title: "Documents to prepare",
    text: "Death certificate / doctor's certificate, valid IDs of the claimant, and the plan contract. Our staff will tell you exactly what your branch needs.",
  },
  {
    icon: Users,
    title: "For the family",
    text: "We arrange the wake, schedule rites and the interment or cremation, and coordinate relatives who are abroad through eBurol online viewing.",
  },
  {
    icon: HeartHandshake,
    title: "Aftercare & grief",
    text: "Grief doesn't follow a schedule. Ask for bereavement support, referrals to counselors, or our aftercare program — all confidential and free.",
  },
];

export default function Help() {
  return (
    <div className="space-y-12">
      <PortalShell
        title="Help & Resources"
        subtitle="We're here around the clock. Reach any of our channels below, or browse the guides for when you need them most."
      />

      {/* Contact channels */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CONTACTS.map((c) => (
          <Card key={c.title} className="flex flex-col p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-evergreen text-white">
              <c.icon className="h-[22px] w-[22px]" />
            </span>
            <h3 className="mt-4 text-[15px] font-bold text-ink">{c.title}</h3>
            <p className="mt-1 text-[13px] font-semibold text-evergreen">{c.line1}</p>
            <p className="mt-0.5 flex-1 text-[11.5px] leading-relaxed text-stone">
              {c.line2}
            </p>
            {"internal" in c && c.internal ? (
              <Link
                to={c.href}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-evergreen/25 px-4 py-2 text-[12px] font-bold text-evergreen transition-colors hover:bg-evergreen hover:text-white"
              >
                {c.cta}
              </Link>
            ) : (
              <a
                href={c.href}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full border border-evergreen/25 px-4 py-2 text-[12px] font-bold text-evergreen transition-colors hover:bg-evergreen hover:text-white"
              >
                {c.cta}
              </a>
            )}
          </Card>
        ))}
      </section>

      {/* At-need guidance */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-evergreen">
          <Sparkles className="h-5 w-5 text-gold" />
          When the time comes
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {GUIDANCE.map((g) => (
            <Card key={g.title} className="flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-evergreen/8 text-evergreen">
                <g.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-[14.5px] font-bold text-ink">{g.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-stone">{g.text}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-evergreen">
          Frequently asked questions
        </h2>
        <Card className="divide-y divide-line overflow-hidden">
          <Accordion type="single" collapsible>
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`}>
                <AccordionTrigger className="px-5 text-left text-[14px] font-bold text-ink hover:no-underline lg:px-7">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-[13px] leading-relaxed text-stone lg:px-7">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      </section>

      {/* App + fine print */}
      <section className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-evergreen px-7 py-8 text-white lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <BrandLogo className="h-7 w-7 rounded-lg" />
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold">
              Bring Evangelist with you
            </h3>
            <p className="mt-1 max-w-md text-[13px] leading-relaxed text-white/70">
              eBurol, payment tracking, chapel locator, and grief resources in our
              free app for iOS and Android.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/">
            <Button className="h-11 rounded-full bg-paper px-6 text-[13.5px] font-bold text-evergreen hover:bg-white">
              Download the app
            </Button>
          </Link>
          <Link to="/portal/services?type=other">
            <Button
              variant="outline"
              className="h-11 rounded-full border-white/30 bg-transparent px-6 text-[13.5px] font-bold text-white hover:bg-white/10 hover:text-white"
            >
              Ask a question
            </Button>
          </Link>
        </div>
      </section>

      <p className="text-[11.5px] leading-relaxed text-stone/80">
        Evangelist Funeral Services · DTI Trust Mark registered online business.
        Your conversations with our team are confidential. Pre-need plans are
        governed by the contract you signed and applicable regulations; contact
        your branch for the full terms of your plan.
      </p>
    </div>
  );
}
