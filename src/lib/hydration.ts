/**
 * Hydration arithmetic, kept free of database and network imports so the
 * rules — the goal, the caps, the way a figure is spoken — can be tested on
 * their own and reused on both sides of the client boundary.
 */

/**
 * What the app assumes when the athlete has never set a target.
 *
 * Deliberately a flat figure rather than one computed from body weight: the
 * arithmetic behind a personalised number is guesswork dressed as advice, and
 * anyone who cares about the difference can set their own below.
 */
export const DEFAULT_WATER_GOAL_ML = 3000;

export const MIN_WATER_GOAL_ML = 500;
export const MAX_WATER_GOAL_ML = 8000;

/**
 * Ceiling on a single day's total. Well past any real intake, and there to
 * stop a mistyped 25000 from flattening every bar on the chart beside it.
 */
export const MAX_WATER_DAY_ML = 15000;

/** The three taps that cover almost every log. */
export const QUICK_ADDS = [
  { label: "Glass", ml: 250 },
  { label: "Bottle", ml: 500 },
  { label: "Litre", ml: 1000 },
] as const;

/** The target in force for an athlete, given whatever they have stored. */
export function waterGoal(stored: number | null | undefined): number {
  if (!stored || !Number.isFinite(stored)) return DEFAULT_WATER_GOAL_ML;
  return Math.min(MAX_WATER_GOAL_ML, Math.max(MIN_WATER_GOAL_ML, Math.round(stored)));
}

/** Millilitres as litres to one place: 2350 → 2.4. */
export function litres(ml: number): number {
  return Math.round(ml / 100) / 10;
}

/**
 * How a figure is spoken. Under a litre it stays in millilitres, which is how
 * anybody would say it — "750 ml", not "0.8 L".
 */
export function formatWater(ml: number): string {
  if (ml <= 0) return "0 ml";
  return ml < 1000 ? `${Math.round(ml)} ml` : `${litres(ml)} L`;
}

/** Share of the goal, capped at 100 for anything that fills a track. */
export function hydrationPct(ml: number, goal: number): number {
  if (goal <= 0) return ml > 0 ? 100 : 0;
  return Math.min(100, Math.round((ml / goal) * 100));
}

/** Whether the day's total met the target. */
export function metGoal(ml: number, goal: number): boolean {
  return goal > 0 && ml >= goal;
}

/** What is left to drink today, or 0 once the goal is met. */
export function remainingMl(ml: number, goal: number): number {
  return Math.max(0, goal - ml);
}
