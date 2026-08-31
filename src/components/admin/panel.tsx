import { cn } from "@/lib/utils";

/** The console's section frame — a title, an optional aside, and content. */
export function Panel({
  title,
  description,
  meta,
  actions,
  tone = "default",
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Sits opposite the title, in mono — a count, a window, a timestamp. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "default" | "accent" | "clay" | "quiet";
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  const tones = {
    default: "border-line-strong bg-surface",
    accent: "border-accent-line bg-accent-soft",
    clay: "border-clay-line bg-clay-soft",
    quiet: "border-line bg-transparent",
  } as const;

  return (
    <section className={cn("rounded-2xl border p-[22px]", tones[tone], className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
            )}
            {description && (
              <p className="mt-1.5 max-w-prose text-[12.5px] leading-relaxed text-fg-dim">
                {description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {meta && (
              <span className="tabular font-mono text-[11px] text-fg-dim">
                {meta}
              </span>
            )}
            {actions}
          </div>
        </div>
      )}

      {children && (
        <div className={cn(title || actions ? "mt-4" : undefined, bodyClassName)}>
          {children}
        </div>
      )}
    </section>
  );
}

const DOT = {
  ok: "bg-sage",
  warn: "bg-clay",
  bad: "bg-clay",
  off: "bg-line-strong",
} as const;

/** A status light with a word beside it — the console's smallest unit of truth. */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: keyof typeof DOT;
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "h-[7px] w-[7px] shrink-0 rounded-full",
          DOT[tone],
          tone === "bad" && "ring-2 ring-clay-line",
        )}
      />
      {label && (
        <span
          className={cn(
            "text-[12px]",
            tone === "off" ? "text-fg-dim" : "text-fg-muted",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/** One wired-up dependency, and whether this deployment actually has it. */
export function ServiceRow({
  name,
  detail,
  live,
  value,
}: {
  name: string;
  detail: string;
  live: boolean;
  /** What it is set to, when saying so gives away nothing. */
  value?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <span
        className={cn(
          "mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full",
          live ? "bg-sage" : "bg-line-strong",
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p
            className={cn(
              "text-[12.5px] font-medium",
              live ? "text-fg" : "text-fg-muted",
            )}
          >
            {name}
          </p>
          {value && (
            <span className="tabular font-mono text-[11px] text-fg-dim">
              {value}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-dim">
          {detail}
        </p>
      </div>
    </li>
  );
}
