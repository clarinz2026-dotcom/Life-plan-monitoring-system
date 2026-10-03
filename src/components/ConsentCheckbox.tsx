import { Link } from "react-router";

/**
 * A consent checkbox.
 *
 * Built on a real `<input type="checkbox">` with a real `<label>`, so it works
 * with a keyboard, is announced by screen readers, and shows the browser's own
 * "required" and "invalid" states. Pre-ticked consent and a link-only
 * "you agree by continuing" are both dark patterns, so the box starts empty and
 * the wording says what is being agreed to.
 */
export default function ConsentCheckbox({
  id,
  checked,
  onChange,
  children,
  /** Shown under the box when the parent form refuses to submit. */
  error,
  required = false,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <div
      className={`rounded-xl border bg-cream/70 px-3.5 py-3 ${
        error ? "border-red-300 bg-red-50/70" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1b4332]"
        />
        <label
          htmlFor={id}
          className="text-[13px] leading-relaxed text-ink/85 select-none"
        >
          {children}
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-[12.5px] font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Inline link to a policy, used inside consent wording. */
export function PolicyLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="font-semibold text-evergreen underline underline-offset-2"
    >
      {children}
    </Link>
  );
}