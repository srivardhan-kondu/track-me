/**
 * Series arithmetic for the charts — smoothing and binning, kept free of React
 * and of the database so the maths can be tested directly.
 */

export type DayValue = { day: Date; value: number };

const DAY_MS = 86_400_000;

/**
 * A trailing mean over a window of *days*, not of points.
 *
 * The distinction is the whole reason this exists. Weigh-ins have gaps — a
 * missed morning, a week away — and averaging "the last seven readings" would
 * quietly stretch the window across those gaps, so a line labelled seven days
 * would sometimes be showing a month. Averaging by date keeps the window
 * honest and simply thins where the data does.
 *
 * Returns one entry per input point, in order, so the smoothed line lands on
 * the same days the raw one does.
 */
export function trailingMeanByDay(
  points: DayValue[],
  windowDays: number,
): DayValue[] {
  const sorted = [...points].sort((a, b) => a.day.getTime() - b.day.getTime());
  const span = windowDays * DAY_MS;

  return sorted.map((point, i) => {
    const from = point.day.getTime() - span + DAY_MS;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (sorted[j].day.getTime() < from) break;
      sum += sorted[j].value;
      n += 1;
    }
    return { day: point.day, value: sum / n };
  });
}

/**
 * The mean of the values that exist, or null when none do.
 *
 * Null rather than zero: no data and an average of nothing are different
 * statements, and a zero would be plotted as a real reading.
 */
export function meanOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, v) => a + v, 0) / values.length;
}

/**
 * Buckets a value into one of `steps` bands by its share of `max`.
 *
 * Zero is deliberately its own answer (-1) rather than the lowest band: on a
 * heatmap, "nothing logged" and "the least of anything logged" must not look
 * like neighbours.
 */
export function band(value: number, max: number, steps: number): number {
  if (value <= 0) return -1;
  if (max <= 0) return 0;
  const i = Math.ceil((value / max) * steps) - 1;
  return Math.min(steps - 1, Math.max(0, i));
}
