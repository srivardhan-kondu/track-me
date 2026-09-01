import { AthletePortrait } from "@/components/dashboard/athlete-portrait";
import { kgToLb, weightLabel, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * The progress ring from the reference: a violet arc on a dark track, with the
 * figure and its caption stacked in the middle.
 */
function Ring({
  pct,
  label,
  caption,
  size = 118,
}: {
  pct: number;
  label: string;
  caption: string;
  size?: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} ${pct}%, ${caption}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-serif text-[26px] leading-none text-fg">
          {pct}%
        </span>
        <span className="mono-label mt-1.5 text-fg-muted">{label}</span>
        <span className="mt-0.5 text-[10px] text-fg-dim">{caption}</span>
      </div>
    </div>
  );
}

/** One figure in the week strip along the bottom of the hero. */
function WeekStat({
  value,
  unit,
  label,
  target,
}: {
  value: string;
  unit?: string;
  label: string;
  /** Shown under the figure as "of 2,400", when a target has been set. */
  target?: string;
}) {
  return (
    <div className="px-1.5 py-3.5 text-center">
      <p className="flex items-baseline justify-center gap-1">
        <span className="tabular font-serif text-[16px] leading-none text-fg">
          {value}
        </span>
        {unit && <span className="text-[10px] text-fg-dim">{unit}</span>}
      </p>
      <p className="mt-1.5 text-[10px] leading-none text-fg-dim">{label}</p>
      {target && (
        <p className="tabular mt-1 text-[9.5px] leading-none text-accent-text">
          of {target}
        </p>
      )}
    </div>
  );
}

export type WeekFigures = {
  workouts: number;
  volumeKg: number;
  /** Mean calories per day logged, not the week's total. */
  avgCalories: number;
  loggedDays: number;
  avgMinutes: number;
};

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(n)}`;
}

/**
 * The greeting card the athlete lands on: who they are, how consistent the
 * week has been, and the week's four figures — over their own portrait.
 *
 * The ring reports logging consistency rather than a recovery score. Track Me
 * reads no wearable, so a recovery figure would be invented; consistency is
 * something the app actually knows.
 */
export function DashboardHero({
  greeting,
  name,
  gender,
  consistencyPct,
  week,
  targetCalories = null,
  weightUnit = "KG",
  action,
}: {
  greeting: string;
  name: string;
  gender: "FEMALE" | "MALE" | null | undefined;
  consistencyPct: number;
  week: WeekFigures;
  /** Null until the athlete sets one in Settings; nothing is shown without it. */
  targetCalories?: number | null;
  /** Tonnage is a lifted weight, so it reads in the athlete's own unit. */
  weightUnit?: WeightUnit;
  /** The primary call to action, rendered under the ring. */
  action?: React.ReactNode;
}) {
  const verdict =
    consistencyPct >= 80
      ? "Well on track"
      : consistencyPct >= 50
        ? "Keep it going"
        : "Room to build";

  return (
    <section className="accent-gradient relative overflow-hidden rounded-[22px] border border-line">
      {/*
        Full card height on purpose: the slot's aspect then matches the tall
        crop on a phone and the wide crop on a desktop, so neither frame is
        squeezed. The figures strip below is opaque and the mask fades the
        photo out before it reaches it, so nothing shows through.
      */}
      <AthletePortrait
        gender={gender}
        priority
        className="absolute inset-y-0 right-0 w-[54%] md:w-[42%] md:max-w-[460px]"
      />

      <div className="relative p-5 sm:p-6">
        <p className="text-[13px] text-fg-muted">{greeting},</p>
        <h1 className="font-serif text-[26px] leading-tight text-fg sm:text-[30px]">
          {name} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-[12.5px] text-fg-muted">
          You&rsquo;ve got this today!
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          <Ring pct={consistencyPct} label="Consistency" caption={verdict} />
          {action && <div className="min-w-0">{action}</div>}
        </div>

        {/*
          Four across even on the narrowest phone, as the reference has it —
          the figures are short enough to fit, and wrapping them to two rows
          would read as two separate panels.
        */}
        <div className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded-[16px] bg-line">
          <div className="bg-surface">
            <WeekStat value={`${week.workouts}`} label="Workouts" />
          </div>
          <div className="bg-surface">
            <WeekStat
              value={compact(
                weightUnit === "LB"
                  ? Math.round(kgToLb(week.volumeKg))
                  : week.volumeKg,
              )}
              unit={weightLabel(weightUnit)}
              label="Volume"
            />
          </div>
          {/*
            A daily average, not the week's total. The figure here used to be
            seven days of eating under a label that read like one day's, which
            is a number nobody can act on.
          */}
          <div className="bg-surface">
            <WeekStat
              value={week.loggedDays > 0 ? compact(week.avgCalories) : "—"}
              label="Avg. calories"
              target={
                targetCalories ? compact(targetCalories) : undefined
              }
            />
          </div>
          <div className="bg-surface">
            <WeekStat
              value={week.avgMinutes > 0 ? `${week.avgMinutes}` : "—"}
              unit={week.avgMinutes > 0 ? "min" : undefined}
              label="Avg. workout"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
