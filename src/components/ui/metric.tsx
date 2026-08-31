import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  default: "text-fg",
  sage: "text-sage-text",
  clay: "text-clay-text",
  accent: "text-accent-text",
  blue: "text-blue-text",
};

/** A hairline row of figures, in place of four separate stat cards. */
export function MetricStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("metric-strip", className)}>{children}</div>;
}

/** One cell of a MetricStrip. */
export function Metric({
  label,
  value,
  unit,
  note,
  tone = "default",
  noteTone = "default",
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  tone?: keyof typeof TONE;
  noteTone?: keyof typeof TONE;
}) {
  return (
    <div className="px-5 py-4">
      <p className="mono-label">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={cn(
            "tabular text-[22px] font-semibold leading-none tracking-[-0.02em]",
            TONE[tone],
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[11px] text-fg-dim">{unit}</span>
        )}
        {note && (
          <span
            className={cn(
              "tabular font-mono text-[11px]",
              noteTone === "default" ? "text-fg-dim" : TONE[noteTone],
            )}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The one figure a screen is actually about, set in the display serif.
 * Used for the headline numbers on Today and Weight.
 */
export function BigStat({
  label,
  value,
  unit,
  note,
  tone = "default",
  size = "md",
  className,
}: {
  label?: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  tone?: keyof typeof TONE;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const scale = {
    sm: "text-[30px]",
    md: "text-[42px]",
    lg: "text-[52px]",
  }[size];

  return (
    <div className={className}>
      {label && <p className="mono-label">{label}</p>}
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2",
          label ? "mt-2.5" : undefined,
        )}
      >
        <span
          className={cn("tabular font-serif leading-none", scale, TONE[tone])}
        >
          {value}
        </span>
        {unit && <span className="text-[13px] text-fg-dim">{unit}</span>}
      </div>
      {note && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-fg-dim">{note}</p>
      )}
    </div>
  );
}

/** A BigStat inside its own hairline box, for a rail or a two-up row. */
export function StatCard({
  label,
  value,
  unit,
  note,
  noteTone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  noteTone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-2xl border border-line px-5 py-4",
        className,
      )}
    >
      <p className="mono-label">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="tabular font-serif text-[30px] leading-none text-fg">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[11px] text-fg-dim">{unit}</span>
        )}
        {note && (
          <span
            className={cn(
              "tabular font-mono text-[11px]",
              noteTone === "default" ? "text-fg-dim" : TONE[noteTone],
            )}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}
