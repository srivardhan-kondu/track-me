import Link from "next/link";

/**
 * Plain links rather than a fetch-and-blob dance: the endpoint already sets
 * Content-Disposition, so the browser downloads it and nothing has to be held
 * in memory on the way through.
 */
const OPTIONS = [
  { href: "/api/export", label: "Everything", hint: "JSON" },
  { href: "/api/export?format=csv&type=workouts", label: "Workouts", hint: "CSV" },
  { href: "/api/export?format=csv&type=meals", label: "Meals", hint: "CSV" },
  { href: "/api/export?format=csv&type=weights", label: "Weigh-ins", hint: "CSV" },
];

export function ExportData() {
  return (
    <div className="flex flex-wrap gap-2.5">
      {OPTIONS.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          prefetch={false}
          download
          className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong px-3 py-2 text-[12px] font-medium text-fg transition-colors hover:bg-hover"
        >
          {o.label}
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fg-faint">
            {o.hint}
          </span>
        </Link>
      ))}
    </div>
  );
}
