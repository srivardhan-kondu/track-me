import { cn, round } from "@/lib/utils";

export type MacroSet = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const MACROS = [
  { key: "protein", label: "Protein", color: "bg-[var(--chart-protein)]" },
  { key: "carbs", label: "Carbs", color: "bg-[var(--chart-carbs)]" },
  { key: "fat", label: "Fat", color: "bg-[var(--chart-fat)]" },
] as const;

/** Compact calories + P/C/F readout used on every meal card. */
export function MacroRow({
  macros,
  className,
}: {
  macros: MacroSet;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <span className="tabular text-sm font-semibold">
        {round(macros.calories) ?? "—"}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          kcal
        </span>
      </span>

      {MACROS.map(({ key, label, color }) => (
        <span key={key} className="flex items-center gap-1.5 text-xs">
          <span className={cn("h-2 w-2 rounded-full", color)} />
          <span className="text-muted-foreground">{label}</span>
          <span className="tabular font-medium">
            {round(macros[key]) ?? "—"}g
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Proportional macro split by calorie contribution
 * (protein and carbs 4 kcal/g, fat 9 kcal/g).
 */
export function MacroSplitBar({ macros }: { macros: MacroSet }) {
  const p = (macros.protein ?? 0) * 4;
  const c = (macros.carbs ?? 0) * 4;
  const f = (macros.fat ?? 0) * 9;
  const total = p + c + f;

  if (total <= 0) return null;

  const segments = [
    { width: (p / total) * 100, color: "bg-[var(--chart-protein)]" },
    { width: (c / total) * 100, color: "bg-[var(--chart-carbs)]" },
    { width: (f / total) * 100, color: "bg-[var(--chart-fat)]" },
  ];

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      {segments.map((s, i) => (
        <div
          key={i}
          className={s.color}
          style={{ width: `${s.width}%` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/** Large stat used in the daily and weekly summary headers. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold" style={{ color: accent }}>
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
