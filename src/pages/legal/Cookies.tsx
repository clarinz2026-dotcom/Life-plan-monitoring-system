import { Link } from "react-router";
import LegalLayout, { PolicySection } from "./LegalLayout";
import {
  COMPANY,
  COOKIE_CONSENT_KEY,
  STORAGE_INVENTORY,
} from "@/lib/legal";

/**
 * Cookie policy.
 *
 * The table is generated from the same constant the cookie notice banner and
 * the consent record use, so a cookie cannot be added without appearing here.
 */
export default function Cookies() {
  return (
    <LegalLayout
      title="Cookie Policy"
      intro={`This site uses a deliberately short list of cookies and stored values, all of which are needed for sign-in or for the page to work. There is no advertising, no analytics, and no third-party tracking on ${COMPANY.legalName}'s website or client portal.`}
    >
      <PolicySection heading="What a cookie is">
        <p>
          A cookie is a small file a website asks your browser to remember.
          Some are set by us; some are set by the service that stores our
          database. &ldquo;Local storage&rdquo; and &ldquo;session
          storage&rdquo; are the same idea kept inside your browser instead of
          in a cookie jar, and this page lists them together.
        </p>
      </PolicySection>

      <PolicySection heading="Everything this site stores">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[14px]">
            <caption className="sr-only">
              Every cookie and stored value used by this site
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  Name
                </th>
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  Type
                </th>
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  Why
                </th>
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  How long
                </th>
              </tr>
            </thead>
            <tbody className="text-ink/85">
              {STORAGE_INVENTORY.map((item) => (
                <tr key={item.name} className="border-b border-line/60 align-top">
                  <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-ink">
                    {item.name}
                  </th>
                  <td className="py-2.5 pr-4">{item.kind}</td>
                  <td className="py-2.5 pr-4">{item.purpose}</td>
                  <td className="py-2.5 pr-4">{item.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          That is the whole list. Every one of these can be removed by clearing
          your browser&rsquo;s storage, or by using the &ldquo;Clear this
          choice&rdquo; button in the notice at the foot of the page. Clearing
          them signs you out and resets the page layout preferences; nothing is
          lost from your plan.
        </p>
      </PolicySection>

      <PolicySection heading="What we do not use">
        <ul className="space-y-2">
          <li>No advertising cookies, pixels, or interest-based advertising.</li>
          <li>No analytics or session-recording scripts — we do not watch how you use the site.</li>
          <li>No third-party trackers, tag managers, or embedded social widgets that would read this page.</li>
          <li>No fingerprinting of your device.</li>
        </ul>
        <p>
          The photographs on the public pages are served by{" "}
          <a
            href="https://unsplash.com/privacy"
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            Unsplash
          </a>
          . Like any image host, it sees your IP address and browser details in
          order to send the picture; no planholder data is involved, and it does
          not place a cookie in your browser.
        </p>
      </PolicySection>

      <PolicySection heading="The cookie notice">
        <p>
          Because everything we store is essential to sign-in, there is nothing
          to opt out of. The notice at the foot of the page simply tells you the
          list above, records that you have seen it ({COOKIE_CONSENT_KEY} in
          your browser&rsquo;s local storage), and gives you a button to clear
          that record. It will not reappear unless you clear it.
        </p>
        <p>
          If we ever add something that is not essential — for example an
          analytics tool — we will ask you first, on this page, and it will not
          be set until you say yes.
        </p>
      </PolicySection>

      <PolicySection heading="Your browser">
        <p>
          Every modern browser lets you see, block, and delete cookies, and can
          refuse local storage. Doing so will stop the portal from remembering
          that you are signed in, but it will not affect your plan, your
          receipts, or your right to ask for them. See the{" "}
          <Link
            to="/legal/privacy"
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            Privacy Policy
          </Link>{" "}
          for how to ask for a copy of your data.
        </p>
      </PolicySection>
    </LegalLayout>
  );
}