import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  claimOne,
  complete,
  fail,
  inFlight,
  MAX_IN_FLIGHT,
  type JobRow,
} from "@/lib/jobs";
import { mergeDictated } from "@/lib/exercise-groups";
import { expandToSets } from "@/lib/live-session";
import { premiumStatus } from "@/lib/session";
import {
  budgetStatus,
  BudgetExhausted,
  charge,
  hasBudget,
} from "@/services/ai/budget";
import { analyzeMeal } from "@/services/ai/nutrition";
import { transcribeAudio } from "@/services/ai/transcribe";
import { parseWorkout } from "@/services/ai/workout";
import { resolveExerciseIds } from "@/services/exercises/resolve";
import { getObject } from "@/services/storage";

/**
 * The AI pipelines, lifted out of the server actions so the job worker can run
 * exactly the same code the upload path does.
 *
 * Nothing in here decides *whether* to run — that is the queue's job. These
 * functions do the work and throw, and the caller records the outcome.
 */

/** The typed description, which is not on the row until a transcript exists. */
type Payload = { description?: string | null } | null;

function describedIn(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { description?: unknown }).description;
  return typeof value === "string" && value.trim() ? value : null;
}

async function runMealAnalysis(mealId: string, typedDescription: string | null) {
  const meal = await db.meal.findUnique({
    where: { id: mealId },
    select: { userId: true, imageKey: true, audioKey: true, transcript: true },
  });
  // Deleted between enqueue and run. Nothing to do, and not an error.
  if (!meal) return;

  // Read the plan here rather than at submission: a trial that lapsed in
  // between should not still buy an analysis.
  const { premium } = await premiumStatus(meal.userId);

  let transcript = meal.transcript;

  // Transcribe only if a previous attempt has not already done it. The
  // transcript is written back immediately below, so a job that fails later —
  // in the vision call, or in its own final write — does not buy the audio a
  // second time on retry. With four attempts that was up to four times the
  // Whisper cost for one meal.
  if (meal.audioKey && !meal.transcript) {
    const audio = await getObject(meal.audioKey);
    const spoken = await transcribeAudio(
      audio,
      meal.audioKey.split("/").pop() ?? "note.webm",
      premium,
    );
    await charge(spoken.costUnits);

    // Fall back to the typed description when speech-to-text is unavailable.
    transcript =
      [spoken.text, typedDescription].filter(Boolean).join(". ") || null;

    if (transcript) {
      await db.meal.update({ where: { id: mealId }, data: { transcript } });
    }
  }

  let imagePayload = null;
  if (meal.imageKey) {
    const buffer = await getObject(meal.imageKey);
    const ext = meal.imageKey.split(".").pop()?.toLowerCase();
    imagePayload = {
      buffer,
      contentType:
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg",
    };
  }

  const result = await analyzeMeal({ transcript, image: imagePayload }, premium);
  await charge(result.costUnits);

  await db.meal.update({
    where: { id: mealId },
    data: {
      transcript,
      title: result.title,
      slot: result.slot ?? undefined,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      fiber: result.fiber,
      items: result.items,
      aiGenerated: result.aiGenerated,
      status: "COMPLETE",
      error: null,
    },
  });
}

async function runWorkoutParse(
  workoutId: string,
  typedDescription: string | null,
) {
  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    select: {
      userId: true,
      audioKey: true,
      transcript: true,
      durationMin: true,
      user: { select: { weightUnit: true } },
    },
  });
  if (!workout) return;

  const { premium } = await premiumStatus(workout.userId);

  let transcript = workout.transcript;

  // Banked on the row as soon as it exists, for the same reason as meals: a
  // retry must not re-buy the transcription.
  if (workout.audioKey && !workout.transcript) {
    const audio = await getObject(workout.audioKey);
    const spoken = await transcribeAudio(
      audio,
      workout.audioKey.split("/").pop() ?? "note.webm",
      premium,
    );
    await charge(spoken.costUnits);

    transcript =
      [spoken.text, typedDescription].filter(Boolean).join(". ") || null;

    if (transcript) {
      await db.workout.update({ where: { id: workoutId }, data: { transcript } });
    }
  }

  const result = await parseWorkout(
    transcript,
    premium,
    workout.user.weightUnit,
  );
  await charge(result.costUnits);

  /*
    An athlete dictating set by set — "t-bar row, twenty-five for thirteen;
    then thirty for ten" — gives the parser one movement and several sets, and
    it faithfully returns one exercise per set. Stored that way, five movements
    become fifteen exercises, each with a single set, and the session reads as
    a list of near-duplicates.

    So consecutive mentions of the same movement are folded back into one
    exercise carrying all of its sets. Only consecutive ones: a movement the
    athlete genuinely returned to at the end of the session is a second block,
    the same as it would be if they had logged it live.
  */
  const merged = mergeDictated(result.exercises, expandToSets);

  // Attach each movement to the catalog so its sets count toward muscle
  // volume. An unrecognised name still logs, just without attribution.
  const catalogIds = await resolveExerciseIds(merged.map((e) => e.name));

  await db.$transaction([
    // Replace any prior parse so a re-run does not duplicate exercises.
    db.exercise.deleteMany({ where: { workoutId } }),
    db.workout.update({
      where: { id: workoutId },
      data: {
        transcript,
        title: result.title,
        // Never overwrite a duration the athlete entered by hand.
        durationMin: workout.durationMin ?? result.durationMin,
        aiGenerated: result.aiGenerated,
        status: "COMPLETE",
        error: null,
        exercises: {
          create: merged.map((ex, i) => ({
            name: ex.name,
            weightKg: ex.weightKg,
            sets: ex.sets,
            reps: ex.reps,
            position: i,
            catalogId: catalogIds[i],
            // A dictated session is stored the same way a logged one is, so
            // it reads back set by set and fills the PREVIOUS column next
            // time this movement comes round.
            setLog: { create: ex.setLog },
          })),
        },
      },
    }),
  ]);
}

/**
 * Parks a job until the budget window rolls over, without spending one of its
 * attempts. Running out of money is not the job's fault, and a job that
 * exhausted its retries on a budget pause would fail for good at midnight.
 */
async function deferUntilTomorrow(job: JobRow) {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 30, 0);

  await db.job.update({
    where: { id: job.id },
    data: {
      state: "QUEUED",
      leaseUntil: null,
      // Hand back the attempt that claiming this job consumed.
      attempts: Math.max(0, job.attempts - 1),
      runAfter: tomorrow,
      lastError: "Deferred: daily AI budget spent",
    },
  });
}

/** Marks the underlying record failed once its job has stopped retrying. */
async function markRecordFailed(job: JobRow, err: unknown) {
  const error = (err as Error)?.message?.slice(0, 400) ?? "Processing failed";
  const data = { status: "FAILED" as const, error };

  if (job.kind === "MEAL_ANALYSIS") {
    await db.meal.updateMany({ where: { id: job.targetId }, data });
  } else {
    await db.workout.updateMany({ where: { id: job.targetId }, data });
  }
}

function revalidateFor(kind: JobRow["kind"]) {
  revalidatePath("/dashboard");
  revalidatePath(
    kind === "MEAL_ANALYSIS" ? "/dashboard/meals" : "/dashboard/workouts",
  );
}

/**
 * Runs one claimed job to completion, recording the outcome on both the job
 * and — only once the job has given up — the record itself.
 *
 * While a job still has attempts left the record stays on PROCESSING: telling
 * an athlete their meal failed, when a retry two minutes later will succeed,
 * is worse than making them wait.
 */
export async function runJob(job: JobRow): Promise<"done" | "retrying" | "failed"> {
  const description = describedIn(job.payload as Payload);

  // Checked here rather than inside the AI services so the job is deferred
  // before any work begins, and — because this path never marks the record
  // FAILED — the athlete's meal stays queued for tomorrow rather than being
  // told it could not be analysed.
  if (!(await hasBudget())) {
    const status = await budgetStatus();
    console.error(`[ai] ${new BudgetExhausted(status).message}`);
    await deferUntilTomorrow(job);
    return "retrying";
  }

  try {
    if (job.kind === "MEAL_ANALYSIS") {
      await runMealAnalysis(job.targetId, description);
    } else {
      await runWorkoutParse(job.targetId, description);
    }

    await complete(job.id);
    revalidateFor(job.kind);
    return "done";
  } catch (err) {
    const { willRetry } = await fail(job, err);

    if (!willRetry) {
      await markRecordFailed(job, err);
      revalidateFor(job.kind);
      return "failed";
    }

    console.warn(
      `[jobs] ${job.kind} ${job.targetId} attempt ${job.attempts} failed; queued for retry`,
    );
    return "retrying";
  }
}

/**
 * The upload path's optimistic attempt: run the job now so a normal upload
 * completes as quickly as it always did.
 *
 * Declines when the deployment is already at its concurrency ceiling — the
 * queue holds the work and the worker picks it up, which is the whole point of
 * having a ceiling. Never throws: the queue is what guarantees the job runs,
 * and this is only an optimisation on top of it.
 */
export async function runNow(jobId: string): Promise<void> {
  try {
    if ((await inFlight()) >= MAX_IN_FLIGHT) return;
    // Leave it queued; the worker will park it properly.
    if (!(await hasBudget())) return;

    const job = await claimOne(jobId);
    if (!job) return;

    await runJob(job);
  } catch (err) {
    // A failure here leaves the job QUEUED or RUNNING with a lease that will
    // expire; either way the worker collects it.
    console.error("[jobs] inline run failed; leaving it for the worker", err);
  }
}
