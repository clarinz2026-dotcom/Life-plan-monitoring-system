import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { LEGAL_DOCS } from "@/lib/legal";

/**
 * 404.
 *
 * A dead end is its own kind of trap: someone who mistypes a link, or follows
 * an old bookmark, should be able to get back to the site and to the policies
 * without hunting for the back button.
 */
export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col bg-paper text-ink"
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold">
            Page not found
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-tight text-evergreen">
            404
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-stone">
            That page is not here. It may have moved, or the link may be out of
            date. Nothing has been lost — your plan, your receipts and your
            statement are still in the portal.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/">
              <Button className="h-12 rounded-full px-7 text-[14.5px] font-bold">
                Go to the home page
              </Button>
            </Link>
            <Link to="/auth?returnTo=%2Fportal">
              <Button
                variant="outline"
                className="h-12 rounded-full border-evergreen/25 px-7 text-[14.5px] font-bold text-evergreen hover:bg-evergreen hover:text-white"
              >
                Open the client portal
              </Button>
            </Link>
          </div>

          <nav aria-label="Policies" className="mt-10">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-stone">
              Or read a policy
            </p>
            <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.to}>
                  <Link
                    to={doc.to}
                    className="text-[13.5px] font-semibold text-evergreen underline underline-offset-2"
                  >
                    {doc.short}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </motion.div>
  );
}