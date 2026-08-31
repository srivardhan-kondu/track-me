import Link from "next/link";
import { Sparkles } from "lucide-react";

import { PRICES } from "@/lib/entitlements";
import { rupees } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Why this entry's numbers look the way they do.
 *
 * A free account's meal is put through the offline estimator instead of the
 * vision model, and its voice note is stored without ever being transcribed.
 * Both used to be silent: the athlete saw a thin number, or nothing at all,
 * with no way to tell whether the app had failed or simply not tried. Saying
 * which it was is owed to them — and it is also the one moment where what
 * Premium buys is obvious, so the offer belongs here rather than in a banner
 * they were not reading.
 */
export function AnalysisNote({
  kind,
  analysed,
  complete,
  hasAudio,
  hasTranscript,
  upsell,
  className,
}: {
  kind: "meal" | "workout";
  /**
   * Whether the model produced these numbers, rather than the fallback. Null
   * for entries logged before the app recorded which it was — silence is the
   * only honest answer there.
   */
  analysed: boolean | null;
  /** Nothing to explain while the job is still running or has failed. */
  complete: boolean;
  hasAudio: boolean;
  hasTranscript: boolean;
  /** The viewer is the owner, and is on the free plan. */
  upsell: boolean;
  className?: string;
}) {
  if (analysed !== false || !complete) return null;

  // Recorded, kept, never sent for transcription — the loudest of the two,
  // because from the athlete's side it looks like the app lost the recording.
  const silent = hasAudio && !hasTranscript;

  const title = silent
    ? "This voice note was not transcribed"
    : kind === "meal"
      ? "Estimated, not analysed"
      : "Parsed offline";

  const body = silent
    ? upsell
      ? `Your recording is saved and nothing is lost. Speech-to-text is part of Premium — it turns a spoken note into ${kind === "meal" ? "macros" : "sets, reps and weight"} on its own.`
      : "The recording is saved. Transcription is not configured on this deployment."
    : kind === "meal"
      ? upsell
        ? "These macros come from a rough word-matching estimate, not from reading your photo. Premium sends the photo to the vision model and returns the real breakdown, per ingredient."
        : "These macros come from the offline estimator rather than the vision model."
      : upsell
        ? "Your sets were read by a simple text parser. Premium understands the whole session — supersets, drop sets and the weights inside a sentence."
        : "These sets were read by the offline parser rather than the model.";

  return (
    <div
      className={cn(
        "rounded-[11px] border border-dashed p-3.5",
        upsell ? "border-accent-line bg-accent-soft" : "border-line-strong",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
        {upsell && <Sparkles className="h-3.5 w-3.5 text-accent-text" />}
        {title}
      </p>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-dim">{body}</p>

      {upsell && (
        <Link
          href="/dashboard/settings"
          className="mt-2.5 inline-flex text-[11.5px] font-medium text-accent-text underline-offset-4 hover:underline"
        >
          Unlock it from {rupees(PRICES.MONTHLY)} a month →
        </Link>
      )}
    </div>
  );
}

/** The same fact in one word, for a row that has no space for a sentence. */
export function EstimateTag({ analysed }: { analysed: boolean | null }) {
  if (analysed !== false) return null;
  return <span className="text-fg-faint">estimated</span>;
}
