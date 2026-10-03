import { Link } from "react-router";
import LegalLayout, { PolicySection } from "./LegalLayout";
import {
  COMPANY,
  DATA_PROCESSORS,
  DATA_REQUEST_PATH,
  THIRD_PARTY_SERVICES,
} from "@/lib/legal";

/**
 * Privacy notice.
 *
 * The lists below are generated from `src/lib/legal.ts` and `package.json`
 * rather than written by hand, so the notice cannot describe a service the
 * application no longer uses.
 */
export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={`This notice explains what personal data ${COMPANY.legalName} collects through this website and the client portal, why we need it, who else can see it, and the rights you have over it. It is written to be read, not to be skipped.`}
    >
      <PolicySection heading="The short version">
        <p>
          We hold the records you give us so we can run your memorial plan: who
          you are, what you are paying for, and what you have paid. We show it
          to you, to the staff of the branch handling your plan, and to nobody
          else. We do not sell it, we do not trade it, and we do not use it to
          advertise anything to you.
        </p>
      </PolicySection>

      <PolicySection heading="What we collect, and why">
        <p>
          Nothing on this list is optional unless it is marked optional. If a
          field is marked optional, leaving it blank will never stop you from
          opening or keeping a plan.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <caption className="sr-only">
              Personal data collected, the reason for each item, and who sees it
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  What we hold
                </th>
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  Why we need it
                </th>
                <th scope="col" className="py-2 font-bold uppercase tracking-wider text-stone">
                  Required?
                </th>
              </tr>
            </thead>
            <tbody className="text-ink/85">
              {[
                ["Full name", "To identify the planholder on the contract and the statement.", "Yes"],
                ["Date of birth", "To confirm the planholder is an adult, and to identify the plan where names repeat.", "Yes"],
                ["Mobile number", "To send collection reminders and to reach you when your plan needs attention.", "Yes"],
                ["Email address", "To send your sign-in code and to link your portal account to your plan.", "Yes"],
                ["Address, city, province", "For service coverage and for the branch that handles your plan.", "Yes"],
                ["Beneficiary names, relationships, ages", "To record who the plan is for, as printed on your Statement of Account.", "Yes"],
                ["Parent or guardian name (minors only)", "To record who consented when a planholder is under 18.", "If under 18"],
                ["Payment records, receipt numbers, dates, amounts", "To calculate your balance and to issue official receipts.", "Yes"],
                ["Branch assignment", "So the right office handles your plan.", "Yes"],
              ].map(([what, why, required]) => (
                <tr key={what} className="border-b border-line/60 align-top">
                  <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-ink">
                    {what}
                  </th>
                  <td className="py-2.5 pr-4">{why}</td>
                  <td className="py-2.5 whitespace-nowrap">{required}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          We also hold technical records: when a member of staff creates, edits,
          or deletes a planholder, contract, payment, or receipt, the change is
          written to an audit log with the staff member&rsquo;s name and the
          time. This is how the office proves what was collected and by whom.
        </p>
        <p>
          We do not collect your religion, your health records, your political
          views, or any photo, fingerprint, or biometric identifier. We do not
          record your browsing history between websites.
        </p>
      </PolicySection>

      <PolicySection heading="Who inside the office can see your record">
        <ul className="space-y-2">
          <li>
            <strong className="text-ink">Your planholder</strong> sees their
            own plan, payments, receipts, and statement in the client portal.
          </li>
          <li>
            <strong className="text-ink">The staff of your branch</strong> —
            the records officer, cashier, branch manager, and supervisor —
            see the planholders and payments for their branch only. This limit
            is enforced on the server, not just hidden on their screen.
          </li>
          <li>
            <strong className="text-ink">Head Office</strong> (the CEO and
            Super Admin) can see all branches, because they are accountable for
            every branch&rsquo;s money.
          </li>
          <li>
            <strong className="text-ink">Collectors</strong> see the accounts
            they are assigned to collect from, and the amounts due — not the
            rest of the plan.
          </li>
        </ul>
        <p>
          Every time staff open, change, or delete a record, the audit log
          records who did it and when.
        </p>
      </PolicySection>

      <PolicySection heading="Outside services that handle your data">
        <p>
          These are the only outside companies that receive anything about you.
          We have listed each one with exactly what it receives.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <caption className="sr-only">
              Third-party services, what each receives, and a link to its terms
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  Service
                </th>
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  What it does
                </th>
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  What it receives
                </th>
              </tr>
            </thead>
            <tbody className="text-ink/85">
              {DATA_PROCESSORS.map((s) => (
                <tr key={s.name} className="border-b border-line/60 align-top">
                  <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-ink">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline underline-offset-2 hover:text-evergreen"
                    >
                      {s.name}
                    </a>
                  </th>
                  <td className="py-2.5 pr-4">{s.purpose}</td>
                  <td className="py-2.5 pr-4">{s.shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          A further {THIRD_PARTY_SERVICES.length - DATA_PROCESSORS.length}{" "}
          services support the site but receive no planholder data: the photo
          host that serves the images on our public pages, and the open-source
          libraries that run inside your browser (PDF generation and spreadsheet
          parsing both happen on your device and never send anything to us).
        </p>
      </PolicySection>

      <PolicySection heading="How long we keep it">
        <p>
          We keep a planholder record for as long as the plan is in force, and
          for the period afterwards that tax and accounting law requires — the
          receipt and payment history is not something we are free to throw
          away. If a plan is cancelled and has never been used, the personal
          details are removed on request; the financial entries are retained for
          the legal period and then deleted.
        </p>
        <p>
          Audit log entries are kept for the same financial period. Sign-in
          codes expire within minutes and are not kept after they are used.
        </p>
      </PolicySection>

      <PolicySection heading="Your rights">
        <p>
          You may ask us to show you what we hold about you, correct anything
          that is wrong, stop sending you non-essential messages, or delete your
          record. Use the{" "}
          <Link
            to={DATA_REQUEST_PATH}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            data request form
          </Link>
          , email{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            {COMPANY.email}
          </a>
          , or ask at any branch. We respond within fifteen days.
        </p>
        <p>
          We will ask you to confirm your identity before we act — usually by
          visiting a branch with a valid ID, or by confirming from the email on
          your record. We will never ask for your six-digit sign-in code, by
          phone, text, email, or in person.
        </p>
      </PolicySection>

      <PolicySection heading="Planholders under 18">
        <p>
          A memorial plan can be opened by an adult on behalf of a child, and a
          young person can hold a plan in their own name. Where the planholder
          is under 18, the parent or legal guardian gives consent in person at
          the branch and their name is recorded on the record. We do not collect
          a child&rsquo;s data through this website: the forms on this site are
          completed by the office on a family&rsquo;s behalf, and the client
          portal is for the adult named on the plan.
        </p>
      </PolicySection>

      <PolicySection heading="Security">
        <p>
          Records are held in an access-controlled database. Access is by
          role, is limited to one branch for branch staff, and every change is
          logged. Read-only API keys, if issued, are stored only as a hash, so a
          copy of the database does not contain working credentials. Passwords
          are never stored: sign-in uses a one-time code sent to your email.
        </p>
        <p>
          No system is perfectly secure. If a breach affects your data, we will
          tell you and the appropriate authority as required by law.
        </p>
      </PolicySection>

      <PolicySection heading="Changes to this notice">
        <p>
          If we change how we use your data we will update this page and change
          the date at the top. If the change is significant, we will tell you
          directly before it takes effect.
        </p>
      </PolicySection>
    </LegalLayout>
  );
}