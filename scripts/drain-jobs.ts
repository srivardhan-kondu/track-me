/**
 * Runs the AI job queue once, locally.
 *
 * In production a Vercel Cron calls /api/jobs/run once a day, which is all a
 * Hobby plan allows. In development there is no cron at all, so anything the
 * upload path could not finish itself — a rate-limited OpenAI call, a job
 * deferred by the concurrency cap — sits in the queue until this drains it.
 *
 *   npm run jobs:drain
 */

import { claim, inFlight, MAX_IN_FLIGHT, purgeFinished } from "../src/lib/jobs";
import { purgeExpired } from "../src/lib/rate-limit";
import { db } from "../src/lib/db";
import { runJob } from "../src/services/processing";

async function main() {
  const running = await inFlight();
  const room = Math.max(0, MAX_IN_FLIGHT - running);

  if (room === 0) {
    console.log(`${running} job(s) already in flight; at the ceiling.`);
    return;
  }

  const jobs = await claim(room);
  if (jobs.length === 0) {
    console.log("Queue is empty.");
  }

  for (const job of jobs) {
    const outcome = await runJob(job);
    console.log(`  ${job.kind} ${job.targetId} → ${outcome}`);
  }

  const [purgedJobs, purgedWindows] = await Promise.all([
    purgeFinished(),
    purgeExpired(),
  ]);
  console.log(
    `\nRan ${jobs.length} job(s). Swept ${purgedJobs} finished job(s), ` +
      `${purgedWindows} closed rate-limit window(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
