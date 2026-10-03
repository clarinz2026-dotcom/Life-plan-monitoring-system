import LegalLayout, { PolicySection } from "./LegalLayout";
import { COMPANY } from "@/lib/legal";

/**
 * Accessibility statement.
 *
 * Only claims that are true of this build are listed. Anything measured rather
 * than asserted is named as such, and a known gap is stated plainly instead of
 * being left out.
 */
export default function Accessibility() {
  return (
    <LegalLayout
      title="Accessibility Statement"
      intro={`${COMPANY.legalName} wants every family to be able to read their own plan — including family members who use a screen reader, a keyboard, larger text, or who are simply not comfortable on a computer. This page says what we have done and what is still imperfect.`}
    >
      <PolicySection heading="What we have done">
        <ul className="space-y-3">
          <li>
            <strong className="text-ink">Keyboard throughout.</strong> Every
            link, button, field, and dialog can be reached and operated with a
            keyboard alone. A &ldquo;skip to the content&rdquo; link is the first
            thing a keyboard user reaches on the policy pages, and focus is
            always drawn with a visible outline.
          </li>
          <li>
            <strong className="text-ink">Labelled controls.</strong> Form fields
            have real labels, icon-only buttons carry a name for screen
            readers, and tables carry header cells so a screen reader announces
            the right column.
          </li>
          <li>
            <strong className="text-ink">Large, plain type.</strong> Body text
            is 16px and above, the client portal is set larger again for older
            readers, and figures are in a typeface with clear digits. Statements
            and receipts use words — &ldquo;Active&rdquo;, &ldquo;Fully
            paid&rdquo; — not colour alone.
          </li>
          <li>
            <strong className="text-ink">Contrast that meets AA.</strong> Text
            and its background are chosen to reach at least a 4.5:1 contrast
            ratio for body text, including the muted greys and the gold
            accents.
          </li>
          <li>
            <strong className="text-ink">Respects your settings.</strong> Text
            scales with your browser&rsquo;s own font size, and the page does
            not disable zoom. Reduced-motion preferences are respected where
            animation is used.
          </li>
          <li>
            <strong className="text-ink">No images of text.</strong> Where a
            photograph carries meaning it is described in text; decorative
            images are marked as decorative for screen readers.
          </li>
        </ul>
      </PolicySection>

      <PolicySection heading="Known limits">
        <p>
          Two parts of the system are not fully accessible yet, and we would
          rather say so than claim otherwise:
        </p>
        <ul className="space-y-2">
          <li>
            The Statement of Account PDF is a picture of the printed form
            generated in your browser, so its text cannot be selected or read by
            a screen reader. The same figures are available as real text on the
            plans page in the portal — please use that if you need an accessible
            copy, and ask the branch for a printed large-type statement.
          </li>
          <li>
            The staff bulk-upload screen expects a spreadsheet in the office
            format and is built for trained staff, not for general use.
          </li>
        </ul>
      </PolicySection>

      <PolicySection heading="If something here is hard to use">
        <p>
          Tell us. Call the {COMPANY.hotline} hotline, email{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            {COMPANY.email}
          </a>
          , or ask any branch. Tell us which page you were on, what you were
          trying to do, and what happened — and, if you can, which browser or
          assistive technology you were using. We will answer within fifteen
          days and tell you what we intend to change.
        </p>
        <p>
          If the portal itself is not usable for you, the branch will read your
          plan to you over the phone and give you a printed statement. That is
          not a lesser service, and you do not have to explain why you need it.
        </p>
      </PolicySection>
    </LegalLayout>
  );
}