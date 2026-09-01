import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AnalysisNote } from "@/components/billing/analysis-note";
import { AudioNote } from "@/components/timeline/audio-note";
import { CommentThread } from "@/components/timeline/comment-thread";
import { MacroRow, MacroSplitBar } from "@/components/timeline/macros";
import { MealActions } from "@/components/timeline/meal-actions";
import { db } from "@/lib/db";
import { premiumStatus, requireUser } from "@/lib/session";
import { formatDateInZone, safeZone } from "@/lib/tz";
import { round } from "@/lib/utils";
import type { TimelineMeal } from "@/services/reporting";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Meal" };

const SLOT_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

type MealItem = { name: string; quantity: string };

function readItems(raw: unknown): MealItem[] {
  return Array.isArray(raw) ? (raw as MealItem[]) : [];
}

/**
 * One meal, in full.
 *
 * The same division the training side makes: the list says what the day added
 * up to, and this says what was actually on the plate — every ingredient the
 * model read, the photograph it read them from, and the note that came with it.
 */
export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const zone = safeZone(user.timeZone);

  const meal = await db.meal.findUnique({
    where: { id },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  if (!meal || meal.userId !== user.id) notFound();

  const [{ premium }, imageUrl, audioUrl] = await Promise.all([
    premiumStatus(user.id),
    mediaUrl(meal.imageKey),
    mediaUrl(meal.audioKey),
  ]);

  const items = readItems(meal.items);
  const complete = meal.status === "COMPLETE";
  const macros = meal as unknown as TimelineMeal;

  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/meals"
          aria-label="Back to meals"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <p className="mono-label">Meal detail</p>
      </div>

      <header>
        <h1 className="font-serif text-[26px] leading-none text-fg sm:text-[30px]">
          {meal.title ?? "Logged meal"}
        </h1>
        <p className="mt-2.5 text-[13px] text-fg-dim">
          {formatDateInZone(meal.eatenAt, zone, {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          {formatDateInZone(meal.eatenAt, zone, {
            hour: "numeric",
            minute: "2-digit",
          })}
          {meal.slot && ` · ${SLOT_LABEL[meal.slot] ?? meal.slot}`}
        </p>
      </header>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="max-h-[320px] w-full rounded-2xl object-cover"
        />
      )}

      <div className="metric-strip">
        <Figure label="Calories" value={round(meal.calories) ?? "—"} />
        <Figure label="Protein" value={round(meal.protein) ?? "—"} unit="g" />
        <Figure label="Carbs" value={round(meal.carbs) ?? "—"} unit="g" />
        <Figure label="Fat" value={round(meal.fat) ?? "—"} unit="g" />
        {/*
          Only where it exists. Every meal logged before fibre was tracked, and
          every meal the offline estimator scored, has no figure — and a blank
          cell saying "Fibre —" on all of them is worse than no cell at all.
        */}
        {meal.fiber != null && (
          <Figure label="Fibre" value={round(meal.fiber) ?? "—"} unit="g" />
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface px-6 py-5">
        <h2 className="text-[13px] font-semibold text-fg">Macro split</h2>
        <MacroSplitBar macros={macros} className="mt-4" />
        <MacroRow macros={macros} className="mt-3.5" />
      </div>

      {items.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface px-5 py-5 sm:px-6">
          <h2 className="text-[13px] font-semibold text-fg">
            What was on the plate
          </h2>
          <ul className="mt-4 overflow-hidden rounded-[10px]">
            {items.map((item, i) => (
              <li
                key={i}
                className={`flex items-center gap-3 px-3 py-2.5 text-[13px] text-fg-muted ${
                  i % 2 === 1 ? "bg-surface-inset" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="tabular shrink-0 text-[12.5px] text-fg-dim">
                  {item.quantity}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface px-6 py-5">
        <AnalysisNote
          kind="meal"
          analysed={meal.aiGenerated}
          complete={complete}
          hasAudio={Boolean(meal.audioKey)}
          hasTranscript={Boolean(meal.transcript)}
          upsell={!premium}
        />

        {audioUrl && <AudioNote src={audioUrl} />}

        {meal.transcript && (
          <p className="font-serif text-[13.5px] italic leading-relaxed text-fg-muted">
            &ldquo;{meal.transcript}&rdquo;
          </p>
        )}
      </section>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CommentThread
            viewerId={user.id}
            canComment
            target={{ mealId: meal.id }}
            comments={meal.comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt.toISOString(),
              author: c.author,
            }))}
          />
        </div>

        <MealActions meal={macros} />
      </div>
    </>
  );
}

function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string;
  unit?: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="mono-label">{label}</p>
      <p className="tabular mt-1.5 text-[19px] font-extrabold leading-none text-fg">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && (
          <span className="ml-1 text-[12px] font-semibold text-fg-dim">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}
