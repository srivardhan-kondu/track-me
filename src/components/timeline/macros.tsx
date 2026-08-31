import { cn, round } from "@/lib/utils";

export type MacroSet = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const MACROS = [
  { key: "protein", label: "Protein", dot: "bg-protein", text: "text-blue-text" },
  { key: "carbs", label: "Carbs", dot: "bg-carbs", text: "text-accent-text" },
  { key: "fat", label: "Fat", dot: "bg-fat", text: "text-clay-text" },
] as const;

/** The P/C/F legend that sits under a meal's split bar. */
export function MacroRow({
  macros,
  className,
}: {
  macros: MacroSet;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
      {MACROS.map(({ key, label, text }) => (
        <span
          key={key}
          className="flex items-baseline gap-1.5 text-[11.5px] text-fg-muted"
        >
          <span className={cn("text-[9px] leading-none", text)}>●</span>
          {label}
          <span className="tabular font-medium text-fg-muted">
            {round(macros[key]) ?? "—"}g
          </span>
        </span>
      ))}
    </div>
  );
}

/** Compact `P 34 · C 57 · F 5` readout, for dense list rows. */
export function MacroTicks({
  macros,
  className,
}: {
  macros: MacroSet;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "tabular flex gap-3 font-mono text-[11px] text-fg-dim",
        className,
      )}
    >
      <span>P {round(macros.protein) ?? "—"}</span>
      <span>C {round(macros.carbs) ?? "—"}</span>
      <span>F {round(macros.fat) ?? "—"}</span>
    </div>
  );
}

/**
 * Proportional macro split by calorie contribution
 * (protein and carbs 4 kcal/g, fat 9 kcal/g).
 */
export function MacroSplitBar({
  macros,
  className,
}: {
  macros: MacroSet;
  className?: string;
}) {
  const p = (macros.protein ?? 0) * 4;
  const c = (macros.carbs ?? 0) * 4;
  const f = (macros.fat ?? 0) * 9;
  const total = p + c + f;

  if (total <= 0) return null;

  const segments = [
    { width: (p / total) * 100, color: "bg-protein" },
    { width: (c / total) * 100, color: "bg-carbs" },
    { width: (f / total) * 100, color: "bg-fat" },
  ];

  return (
    <div className={cn("flex h-[5px] w-full gap-[2px]", className)}>
      {segments.map((s, i) => (
        <div
          key={i}
          className={cn("first:rounded-l-full last:rounded-r-full", s.color)}
          style={{ width: `${s.width}%` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
