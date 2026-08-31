/**
 * Units of measure, kept free of database and network imports so the
 * conversions can be tested on their own and used on both sides of the client
 * boundary.
 *
 * Everything Track Me stores is metric — kilograms, centimetres, millilitres —
 * and nothing here changes that. A pound is a way of reading a number, not a
 * way of keeping one: an athlete who switches to pounds must see the same
 * history they had a moment earlier, and a coach reading their log must see
 * the figures the athlete actually entered. So the conversion happens at the
 * two edges, on the way to a screen and on the way in from a form, and the
 * column in between never moves.
 */

/** Mirror the Prisma enums; local unions keep this module dependency-free. */
export type WeightUnit = "KG" | "LB";
export type HeightUnit = "CM" | "FT";
export type VolumeUnit = "ML" | "FL_OZ";

export type UnitPrefs = {
  weight: WeightUnit;
  height: HeightUnit;
  volume: VolumeUnit;
};

/** What an account starts on, and what any unreadable preference falls back to. */
export const METRIC: UnitPrefs = { weight: "KG", height: "CM", volume: "ML" };

/** Normalises whatever came out of the database into a usable set. */
export function unitPrefs(
  row:
    | {
        weightUnit?: string | null;
        heightUnit?: string | null;
        volumeUnit?: string | null;
      }
    | null
    | undefined,
): UnitPrefs {
  return {
    weight: row?.weightUnit === "LB" ? "LB" : "KG",
    height: row?.heightUnit === "FT" ? "FT" : "CM",
    volume: row?.volumeUnit === "FL_OZ" ? "FL_OZ" : "ML",
  };
}

const LB_PER_KG = 2.2046226218;
const CM_PER_INCH = 2.54;
/** The US fluid ounce, which is what a bottle in the shops is labelled in. */
const ML_PER_FL_OZ = 29.5735295625;

function fix(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/* -------------------------------------------------------------------------
   Weight
   ------------------------------------------------------------------------- */

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;

export const weightLabel = (unit: WeightUnit) => (unit === "LB" ? "lb" : "kg");

/**
 * A tenth of a kilogram and a tenth of a pound are both finer than any
 * bathroom scale reads, so a displayed weight gets one place either way. A
 * *change* is different: 0.01 kg is a real reading on a good scale, which is
 * why a check-in stores two places and a delta shows them.
 */
export const WEIGHT_DIGITS = 1;
export const weightDeltaDigits = (unit: WeightUnit) => (unit === "LB" ? 1 : 2);

/** A stored weight as the athlete's own unit, rounded for display. */
export function displayWeight(
  kg: number,
  unit: WeightUnit,
  digits = WEIGHT_DIGITS,
): number {
  return fix(unit === "LB" ? kgToLb(kg) : kg, digits);
}

/** A number typed into a form, back to the kilograms the column holds. */
export function toKg(value: number, unit: WeightUnit): number {
  return fix(unit === "LB" ? lbToKg(value) : value, 2);
}

export function formatWeight(
  kg: number | null | undefined,
  unit: WeightUnit,
  { withUnit = true }: { withUnit?: boolean } = {},
): string {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return "—";
  const n = displayWeight(kg, unit);
  return withUnit ? `${n} ${weightLabel(unit)}` : String(n);
}

/** A change, signed, at the precision the unit deserves. */
export function formatWeightDelta(kg: number, unit: WeightUnit): string {
  const n = displayWeight(kg, unit, weightDeltaDigits(unit));
  return `${n > 0 ? "+" : ""}${n}`;
}

/**
 * The bounds a weight form accepts, expressed in the unit on screen.
 *
 * Derived from the stored range of 20–400 kg rather than written out twice, and
 * narrowed inwards so a value at either end still converts back inside it.
 */
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 400;

export function weightBounds(unit: WeightUnit): {
  min: number;
  max: number;
  step: number;
} {
  if (unit === "LB") {
    return {
      min: Math.ceil(kgToLb(WEIGHT_MIN_KG)),
      max: Math.floor(kgToLb(WEIGHT_MAX_KG)),
      step: 0.1,
    };
  }
  return { min: WEIGHT_MIN_KG, max: WEIGHT_MAX_KG, step: 0.01 };
}

/**
 * A session's or a week's tonnage.
 *
 * Metric tonnes are how a lifter states a big total; in pounds nobody says
 * "short tons", they say thousands of pounds. Both take kilograms, since that
 * is what the sets are stored in.
 */
export function formatTonnage(kg: number, unit: WeightUnit): string {
  if (unit === "LB") {
    const lb = kgToLb(kg);
    return lb >= 1000 ? `${fix(lb / 1000, 1)}k lb` : `${Math.round(lb)} lb`;
  }
  return `${fix(kg / 1000, 1)} t`;
}

/* -------------------------------------------------------------------------
   Height
   ------------------------------------------------------------------------- */

export const cmToInches = (cm: number) => cm / CM_PER_INCH;
export const inchesToCm = (inches: number) => inches * CM_PER_INCH;

/**
 * Feet and inches, with the carry handled: 71.6 cm-worth of inches rounds to
 * 12, which is a foot, not "5 foot 12".
 */
export function feetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cmToInches(cm));
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

export function fromFeetInches(feet: number, inches: number): number {
  return fix(inchesToCm(feet * 12 + inches), 1);
}

export function formatHeight(
  cm: number | null | undefined,
  unit: HeightUnit,
): string {
  if (cm === null || cm === undefined || Number.isNaN(cm)) return "—";
  if (unit === "FT") {
    const { feet, inches } = feetInches(cm);
    return `${feet}′ ${inches}″`;
  }
  return `${fix(cm, 1)} cm`;
}

export const HEIGHT_MIN_CM = 90;
export const HEIGHT_MAX_CM = 250;

/* -------------------------------------------------------------------------
   Volume
   ------------------------------------------------------------------------- */

export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;
export const flOzToMl = (oz: number) => oz * ML_PER_FL_OZ;

export const volumeLabel = (unit: VolumeUnit) =>
  unit === "FL_OZ" ? "fl oz" : "ml";

/** A stored volume in the athlete's own unit — whole fluid ounces. */
export function displayVolume(ml: number, unit: VolumeUnit): number {
  return unit === "FL_OZ" ? Math.round(mlToFlOz(ml)) : Math.round(ml);
}

export function toMl(value: number, unit: VolumeUnit): number {
  return Math.round(unit === "FL_OZ" ? flOzToMl(value) : value);
}

/**
 * How a volume is spoken.
 *
 * Metric switches to litres at a litre, because that is how anybody says it —
 * "750 ml", then "2.4 L". Fluid ounces do not switch: a US pint and quart are
 * not what a water bottle is labelled in, and nobody tracking intake thinks in
 * them.
 */
export function formatVolume(ml: number, unit: VolumeUnit): string {
  if (unit === "FL_OZ") return `${displayVolume(ml, unit)} fl oz`;
  if (ml <= 0) return "0 ml";
  return ml < 1000 ? `${Math.round(ml)} ml` : `${fix(ml / 1000, 1)} L`;
}
