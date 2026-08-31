/**
 * Measures how much the nutrition estimate moves across repeated runs of the
 * same input. Consistency matters more than any single number here: a coach
 * cannot read a trend that jumps by 20% when nothing changed.
 *
 *   node --import tsx --env-file=.env scripts/check-variance.ts [runs]
 */
import { analyzeMeal } from "../src/services/ai/nutrition";

const RUNS = Number(process.argv[2] ?? 5);

const MEAL = "One scoop whey, one scoop oats, one banana, 150 ml milk.";

function spread(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
  );
  return { min, max, mean, sd, rangePct: mean ? ((max - min) / mean) * 100 : 0 };
}

async function main() {
  console.log(`\n"${MEAL}"`);
  console.log(`${RUNS} identical runs\n`);

  const kcal: number[] = [];
  const protein: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    const r = await analyzeMeal({ transcript: MEAL, image: null });
    kcal.push(r.calories);
    protein.push(r.protein);
    console.log(
      `  run ${i + 1}  ${String(Math.round(r.calories)).padStart(4)} kcal  ` +
        `${String(Math.round(r.protein)).padStart(3)}g P  ` +
        `[${r.items.map((x) => `${x.name} ${x.quantity}`).join(", ")}]`,
    );
  }

  for (const [label, values] of [
    ["calories", kcal],
    ["protein", protein],
  ] as const) {
    const s = spread(values);
    console.log(
      `\n  ${label}: ${Math.round(s.min)}–${Math.round(s.max)} ` +
        `(mean ${Math.round(s.mean)}, sd ${s.sd.toFixed(1)}, spread ${s.rangePct.toFixed(1)}%)`,
    );
  }
  console.log("");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
