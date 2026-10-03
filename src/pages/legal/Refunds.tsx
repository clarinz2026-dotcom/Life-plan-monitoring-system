import LegalLayout, { PolicySection } from "./LegalLayout";
import { COMPANY, DATA_REQUEST_PATH, NO_HIDDEN_FEES_STATEMENT } from "@/lib/legal";
import { PLAN_FORMULATIONS } from "@/lib/planFormulation";
import { Link } from "react-router";

const peso = (n: number) =>
  "₱" + n.toLocaleString("en-PH", { maximumFractionDigits: 0 });

/**
 * Refund policy.
 *
 * The price table is read from the same `PLAN_FORMULATIONS` constant the
 * contract form and the server use to price a plan, so the published price can
 * never differ from the price the office charges.
 */
export default function Refunds() {
  return (
    <LegalLayout
      title="Refund Policy"
      intro={`What a plan costs, what can be given back, and how long it takes. This page states every charge we make. ${COMPANY.legalName} does not have a fee that appears only at the counter.`}
    >
      <PolicySection heading="What a plan costs">
        <p>{NO_HIDDEN_FEES_STATEMENT}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[14.5px]">
            <caption className="sr-only">
              Plan value and monthly installment for each plan
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2 pr-4 font-bold uppercase tracking-wider text-stone">
                  Plan
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-bold uppercase tracking-wider text-stone">
                  Plan value
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-bold uppercase tracking-wider text-stone">
                  Monthly
                </th>
                <th scope="col" className="py-2 text-right font-bold uppercase tracking-wider text-stone">
                  Term
                </th>
              </tr>
            </thead>
            <tbody className="text-ink/85">
              {PLAN_FORMULATIONS.map((plan) => (
                <tr key={plan.name} className="border-b border-line/60">
                  <th scope="row" className="py-2.5 pr-4 text-left font-semibold text-ink">
                    {plan.name}
                  </th>
                  <td className="py-2.5 pr-4 text-right font-semibold">{peso(plan.planAmount)}</td>
                  <td className="py-2.5 pr-4 text-right">{peso(plan.monthly)}</td>
                  <td className="py-2.5 text-right">60 months</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The monthly amount is set by the office and is the same on every
          statement. A plan that is paid ahead shows a smaller balance, not a
          different rate. If a collector quotes you a different amount, call
          the {COMPANY.hotline} hotline before paying.
        </p>
      </PolicySection>

      <PolicySection heading="Fees we do not charge">
        <ul className="space-y-2">
          <li>No enrolment or application fee.</li>
          <li>No monthly service or maintenance fee on top of the installment.</li>
          <li>No fee to view, print, or download your statement or receipts in the portal.</li>
          <li>No charge for the reminder messages the office sends about your plan.</li>
          <li>No fee on any part of this website.</li>
        </ul>
        <p>
          Third-party costs are yours, not ours: your own telco charges for an
          SMS, or your bank&rsquo;s fee on a transfer, are not billed by us and
          we do not add anything for them.
        </p>
      </PolicySection>

      <PolicySection heading="When a refund can be given">
        <p>
          A refund depends on what the plan has already been used for, so it is
          decided by the office and confirmed to you in writing. In general:
        </p>
        <ul className="space-y-3">
          <li>
            <strong className="text-ink">Not yet used.</strong> If the plan has
            not been claimed and no service has been rendered, the amounts
            actually paid may be returned less any amount already applied to
            cover a cost the office has borne on your behalf.
          </li>
          <li>
            <strong className="text-ink">Partly used.</strong> If a service has
            already been provided under the plan, only the balance of what was
            paid over what the service cost can be returned. The office will
            show you that calculation, in writing, on request.
          </li>
          <li>
            <strong className="text-ink">Planholder died and the plan was used.</strong>{" "}
            A refund is generally not available once the plan has been claimed,
            because the service it paid for has been delivered. The office will
            explain what, if anything, is returned.
          </li>
          <li>
            <strong className="text-ink">A payment we took in error.</strong> If
            we collected more than we should have — a duplicated payment, a
            payment on the wrong plan, or an amount entered wrongly — the
            difference is returned in full. Tell us and we will correct the
            record.
          </li>
        </ul>
      </PolicySection>

      <PolicySection heading="How to ask for one">
        <p>
          Call the {COMPANY.hotline} hotline, email{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            {COMPANY.email}
          </a>
          , or visit any branch with a valid ID and your plan number. Ask for
          the branch that holds your record, so the answer comes from the people
          who can see the ledger. You do not need to explain why you are asking.
        </p>
      </PolicySection>

      <PolicySection heading="How long it takes">
        <ul className="space-y-2">
          <li>
            <strong className="text-ink">Acknowledgement:</strong> within three
            business days.
          </li>
          <li>
            <strong className="text-ink">Decision:</strong> within fifteen days
            of the request, once the branch has checked the ledger.
          </li>
          <li>
            <strong className="text-ink">Payment:</strong> within thirty days of
            the decision. Refunds are paid the same way the payment came in
            where that is possible; otherwise by bank transfer to an account in
            the planholder&rsquo;s name. Cash refunds are given with a receipt.
          </li>
        </ul>
        <p>
          No fee is charged for making a request or for the refund itself. If a
          request is refused, the office will tell you the reason and what you
          can do next — ask for the general manager, and you may take the matter
          up with the relevant government consumer authority.
        </p>
      </PolicySection>

      <PolicySection heading="If a refund is not paid">
        <p>
          Call the hotline and ask for the manager of the branch holding your
          record. If it is still unresolved, write to{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            {COMPANY.email}
          </a>{" "}
          quoting your plan number. You can also ask us for the data we hold
          about you through the{" "}
          <Link
            to={DATA_REQUEST_PATH}
            className="font-semibold text-evergreen underline underline-offset-2"
          >
            data request form
          </Link>
          .
        </p>
      </PolicySection>
    </LegalLayout>
  );
}