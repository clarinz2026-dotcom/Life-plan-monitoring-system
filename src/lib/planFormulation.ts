/**
 * The office's plan formulation.
 *
 * Each plan type bills a fixed plan value and monthly amortization, so the
 * moment a planholder's plan is known the two money fields on the contract
 * are known too:
 *
 *   | Plan    | Plan value | Monthly |
 *   |---------|-----------:|--------:|
 *   | Isidore |     30,000 |     500 |
 *   | Gabriel |     39,000 |     650 |
 *   | Raphael |     51,000 |     850 |
 *   | Michael |     57,000 |     950 |
 *
 * Every line is the monthly rate × the 60-month term the rest of the app
 * already assumes (`fullPlanPrice` in `src/convex/plans.ts`), which is why a
 * statement, the aging report and a bulk import all read the same numbers.
 *
 * Used in three places so they can never disagree:
 *   - `contracts.create` / `contracts.update` apply it server-side, so a
 *     contract can never be stored with values that contradict its plan type.
 *   - The New Contract / Edit contract dialogs in `ClientDetail` fill the two
 *     money fields as soon as a formulated plan name is typed.
 */

/** A plan type's fixed money pair, as the office formulates it. */
export interface PlanFormulation {
  /** Canonical plan name — matches what staff type, e.g. "Isidore". */
  name: string;
  /** Total plan value in pesos. */
  planAmount: number;
  /** Monthly amortization in pesos. */
  monthly: number;
}

/** The four formulated plans. */
export const PLAN_FORMULATIONS: readonly PlanFormulation[] = [
  { name: "Isidore", planAmount: 30_000, monthly: 500 },
  { name: "Gabriel", planAmount: 39_000, monthly: 650 },
  { name: "Raphael", planAmount: 51_000, monthly: 850 },
  { name: "Michael", planAmount: 57_000, monthly: 950 },
];

/**
 * Lowercase and drop everything that isn't a letter or digit, so "St. Isidore",
 * "ISIDORE " and "isidore" all reduce to the same key.
 */
function normalize(value: string): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The formulation for a plan type, or null when the plan isn't one of the four.
 *
 * The typed name may carry the office's usual adornments — "St. Isidore",
 * "ISIDORE", trailing spaces — so a match is made on the normalized name, and
 * a formulation name embedded in a longer one still counts ("St. Gabriel Plan").
 * Nothing short is matched that way, so a plan merely containing "MI" or "RA"
 * can't pick up the wrong formulation by accident.
 */
export function formulationFor(
  planType: string | null | undefined
): PlanFormulation | null {
  const typed = normalize(planType ?? "");
  if (!typed) return null;

  return (
    PLAN_FORMULATIONS.find((plan) => {
      const key = normalize(plan.name);
      if (typed === key) return true;
      if (key.length < 4) return false;
      return typed.includes(key);
    }) ?? null
  );
}

/**
 * The formulated plan value and monthly amortization for a plan type, or null
 * when the plan isn't formulated (a legacy or office-defined plan keeps the
 * numbers entered for it).
 */
export function formulatedValues(
  planType: string | null | undefined
): { planAmount: number; monthlyAmortization: number } | null {
  const plan = formulationFor(planType);
  if (!plan) return null;
  return { planAmount: plan.planAmount, monthlyAmortization: plan.monthly };
}
