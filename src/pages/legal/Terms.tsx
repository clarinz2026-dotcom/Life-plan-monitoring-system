import LegalLayout, { PolicySection } from "./LegalLayout";
import {
  COLLECTION_PROMISE,
  COMPANY,
  DATA_REQUEST_PATH,
  NO_HIDDEN_FEES_STATEMENT,
} from "@/lib/legal";
import { Link } from "react-router";

/**
 * Terms of service.
 *
 * Written so that nothing here contradicts what the application actually does
 * — the amounts, the branches, and the collection rules are the same ones the
 * staff screen enforces.
 */
export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={`These terms apply when you use this website or sign in to the client portal. They say what you can expect from ${COMPANY.legalName}, and what we ask of you. They do not replace the plan contract you signed with the office — that contract governs the plan itself.`}
    >
      <PolicySection heading="Who may use this site">
        <p>
          The client portal is for the adult named on a plan, or for someone
          they have authorised. The staff portal is for employees of the office
          and for the agents and collectors the office has issued accounts to.
          Staff access is granted by the office and is limited to the branch the
          staff member works in.
        </p>
        <p>
          You need an internet connection and an email address you can read. A
          six-digit code is sent to the email on the record; there is no
          password to lose or share.
        </p>
      </PolicySection>

      <PolicySection heading="What this site is, and what it is not">
        <p>
          This site shows records. It does not create them. A plan, its value,
          its monthly amount, its effectivity date, and its status are set by
          the office and confirmed on the contract you signed; the portal
          reproduces that contract, and the Statement of Account reproduces it
          again as a printable form.
        </p>
        <p>
          If a figure on this site disagrees with the paper contract you signed,
          the contract and the office&rsquo;s records are correct and we will fix
          the site. Tell us through any of the channels on this page.
        </p>
        <p>
          This site is not a government service, is not affiliated with any
          government office, and does not give legal, financial, or tax advice.
          A claim on a plan is handled by the office under the terms of the plan
          contract, not under these terms.
        </p>
      </PolicySection>

      <PolicySection heading="What you pay">
        <p>{NO_HIDDEN_FEES_STATEMENT}</p>
        <p>
          The full schedule is on the{" "}
          <Link to="/legal/refunds" className="font-semibold text-evergreen underline underline-offset-2">
            Refund Policy
          </Link>
          , and the amounts in force are shown on the plan catalogue in the
          staff portal. If anyone quotes you a different amount for the same
          plan, call the office before you pay and ask them to put it in
          writing.
        </p>
      </PolicySection>

      <PolicySection heading="How we collect">
        <p>
          Reminders may be sent by SMS or email, and visits may be arranged by
          phone. These are administrative messages about a plan you hold. They
          stop when you ask: use the{" "}
          <Link
            to={DATA_REQUEST_PATH}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            data request form
          </Link>{" "}
          to stop non-essential messages. Sign-in codes continue regardless,
          because they are how we prove you are you.
        </p>
        <p>We will never:</p>
        <ul className="space-y-2">
          {COLLECTION_PROMISE.map((promise) => (
            <li key={promise} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-evergreen" />
              <span>{promise}</span>
            </li>
          ))}
        </ul>
        <p>
          If a collector pressures you, or asks for payment into a personal
          account, call the hotline. We will deal with it.
        </p>
      </PolicySection>

      <PolicySection heading="Your account">
        <p>
          Keep your email address current. If it changes, the sign-in code will
          go to the old address and the portal will look like it has lost your
          plan. Ask the branch to update it, or use the account-linking form in
          the portal.
        </p>
        <p>
          Do not let anyone else use your sign-in code, and tell the office
          immediately if you think someone has seen it. A code is valid for a
          short time only and can be used once.
        </p>
      </PolicySection>

      <PolicySection heading="Acceptable use">
        <p>
          Please do not attempt to reach records that are not yours, probe the
          system, resell the data, or use the portal to harass the office or
          another family. We may suspend an account that does this, and where
          records were accessed improperly we will tell you and report it where
          the law requires.
        </p>
      </PolicySection>

      <PolicySection heading="Availability">
        <p>
          The portal is offered as a service and may be unavailable for
          maintenance or for reasons outside our control. The record of your
          plan does not depend on it: your contract, your receipts, and your
          official receipts remain valid and usable at any branch. Please keep
          your own copies of receipts.
        </p>
      </PolicySection>

      <PolicySection heading="Fonts, images, and other material">
        <p>
          The wordmark typeface (Brayles) and the company logo belong to{" "}
          {COMPANY.legalName} and are used with permission. Photographs on the
          public pages of this site are served by Unsplash and are used under
          the{" "}
          <a
            href="https://unsplash.com/license"
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            Unsplash Licence
          </a>
          , which allows commercial use without further permission; individual
          photographers are credited in the image metadata. Arial and Times New
          Roman are used under the terms of their respective licences and are
          not redistributed by this site.
        </p>
        <p>
          You may print and keep the statements and receipts shown here for your
          own records. You may not republish them, or use the company name or
          logo, without written permission.
        </p>
      </PolicySection>

      <PolicySection heading="Changes to these terms">
        <p>
          We may update these terms. The date at the top always shows the
          current version. Continuing to use the site after a change means you
          accept it.
        </p>
      </PolicySection>

      <PolicySection heading="Complaints">
        <p>
          If something has gone wrong, call the {COMPANY.hotline} hotline or
          email{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            {COMPANY.email}
          </a>
          . We would rather hear about a problem than read about it. If you
          are not satisfied with our answer, you may take the matter up with the
          relevant government consumer authority.
        </p>
      </PolicySection>
    </LegalLayout>
  );
}