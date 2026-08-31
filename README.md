# Track Me

AI-powered fitness reporting. Athletes log meals, workouts and weigh-ins by
voice and photo; coaches review everything from one dashboard.

The goal is not calorie counting. The goal is accountability.

---

## What works today

**Athlete**

- Log a meal from a photo, a voice note, a typed description, or any combination
- Whisper transcribes the voice note; GPT Vision estimates calories and macros
  per ingredient
- Log a workout by dictating it ("bench press 80 kilos, 3 sets of 8") — parsed
  into structured exercises with weight, sets and reps
- Daily morning weight check-in (one entry per day, editable) with optional photo
- Progress photos by pose (front / side / back), grouped into monthly history
- A dated timeline merging meals, workouts and weigh-ins in chronological order
- Correct any AI estimate by hand; your numbers replace the model's
- Day-by-day navigation through history

**Coach**

- Roster of athletes with an at-a-glance compliance signal
- Per-athlete review: weekly summary, 90-day weight trend, 14-day consistency
  strip, and the full daily timeline
- Threaded comments on any meal, workout or weigh-in
- Add athletes by the email they signed up with

**Both**

- Google sign-in, light/dark theme, mobile-first layout with a bottom tab bar

---

## Quick start

```bash
npm install
docker run -d --name trackme-postgres \
  -e POSTGRES_USER=trackme -e POSTGRES_PASSWORD=trackme -e POSTGRES_DB=trackme \
  -p 55433:5432 postgres:18-alpine

npm run db:push     # create the tables
npm run db:seed     # ~3 weeks of demo history for a coach and two athletes
npm run dev
```

Open http://localhost:3000 and sign in with any of the seeded accounts:

| Email               | Role    |
| ------------------- | ------- |
| `coach@trackme.dev`   | Coach   |
| `athlete@trackme.dev` | Athlete |
| `priya@trackme.dev`   | Athlete |

### Using a hosted database

Neon has the simplest free tier and needs no card.

1. Sign up at **https://neon.tech** and create a project (any region near you).
2. On the project dashboard, copy the **connection string**.
3. Point the app at it — the string is read from stdin, so it never reaches
   your shell history:

   ```bash
   npm run db:url      # paste the string when prompted
   npm run db:setup    # creates the tables, seeds demo data, verifies
   ```

`db:url` detects the provider, derives the pooled/direct pair, adds
`sslmode=require`, and backs up your previous `.env` to `.env.bak`.

Prisma needs two URLs: `DATABASE_URL` (pooled, used at runtime) and
`DIRECT_URL` (unpooled, used for schema pushes — these cannot run through
pgBouncer). On Neon the two differ only by a `-pooler` suffix in the hostname,
so both are derived from whichever one you paste. **Supabase** uses separate
hosts for each, so set `DIRECT_URL` by hand there (direct is port 5432, pooled
is 6543).

`npm run db:check` reports what a connection string actually resolves to and
diagnoses common failures.

### Verifying the AI integration

With `OPENAI_API_KEY` set, `npm run check:ai` calls the real services and
reports what came back — transcription, per-ingredient macros, and workout
parsing, including whether the totals match the sum of the items:

```bash
npm run check:ai                  # nutrition + workout parsing
npm run check:ai -- note.m4a      # also transcribe an audio file
npm run check:ai -- note.m4a meal.jpg   # and analyse a photo
```

### Runs without cloud credentials

Every external dependency degrades to a local equivalent so the app is fully
usable before you have any keys:

| Service           | Configured                       | Not configured                                                     |
| ----------------- | -------------------------------- | ------------------------------------------------------------------ |
| Google OAuth      | Google sign-in                   | Email-only development sign-in (**disabled in production builds**)  |
| OpenAI            | Whisper + GPT Vision             | Offline keyword estimator; voice notes stored but not transcribed   |
| Cloudflare R2     | Objects in your bucket           | Objects written to `.uploads/`, served via an authenticated route   |

`/dashboard/settings` shows which mode this deployment is in.

---

## Deploying

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full path to production
(Vercel + Neon + Cloudflare R2), including the Google OAuth ordering that trips
up most first deploys.

## Configuration

Copy `.env.example` to `.env`.

```bash
DATABASE_URL="postgresql://trackme:trackme@localhost:55433/trackme?schema=public"

AUTH_SECRET="..."            # openssl rand -base64 32
AUTH_URL="http://localhost:3000"
AUTH_GOOGLE_ID=""            # Google Cloud console → OAuth 2.0 client
AUTH_GOOGLE_SECRET=""

R2_ACCOUNT_ID=""             # Cloudflare → R2 → account id
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET=""
R2_PUBLIC_BASE_URL=""        # optional CDN base; presigned URLs are used without it

OPENAI_API_KEY=""
OPENAI_TRANSCRIBE_MODEL="whisper-1"
OPENAI_VISION_MODEL="gpt-4o"
```

Google OAuth redirect URI: `http://localhost:3000/api/auth/callback/google`.

> **Production checklist.** Set `AUTH_SECRET` to a fresh random value and
> configure `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — a production build with no
> Google credentials has **no sign-in provider at all**, which is deliberate: the
> development sign-in must never be reachable in production.

---

## Commands

```bash
npm run dev         # dev server
npm run build       # prisma generate + production build
npm start           # serve the production build
npm test            # parser and storage unit tests
npm run check:ai    # exercise the real OpenAI integration (needs a key)
npm run check:variance  # measure estimate consistency across repeated runs
npm run typecheck   # tsc --noEmit
npm run db:url      # point .env at a hosted database (reads stdin)
npm run db:setup    # push schema + seed + verify, in one step
npm run db:check    # validate the connection and report contents
npm run db:push     # sync schema to the database
npm run db:seed     # reseed demo data
npm run db:studio   # Prisma Studio
```

---

## Architecture

```
src/
  app/
    actions/         server actions (meals, workouts, weight, coach)
    api/
      auth/          Auth.js route handler
      media/         authenticated media route (local storage mode)
      processing/    in-flight AI job status, polled by the client
    dashboard/       athlete: today, meals, workouts, weight, progress, settings
    trainer/         coach: roster and per-athlete review
  components/
    ui/              shadcn-style primitives (Radix + CVA)
    log/             capture: voice recorder, image picker, forms
    timeline/        timeline rendering, macros, comments
    charts/          weight trend (inline SVG), compliance strip
    layout/          nav, theme toggle, user menu
  services/
    ai/              transcription, nutrition, workout parsing, offline fallback
    storage/         R2 with a local filesystem driver
    reporting.ts     timeline, daily totals, summaries, compliance
  lib/               db, auth, session guards, uploads, utils
prisma/              schema and seed
tests/               parser and storage tests
```

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · Radix ·
Prisma + PostgreSQL · Auth.js · Cloudflare R2 · OpenAI · React Query

### How a meal becomes macros

```
upload (photo + voice + notes)
  → server action validates and stores the media
  → Meal row created with status PROCESSING, response returns immediately
  → after() runs post-response:
       Whisper transcribes the voice note
       GPT Vision estimates per-ingredient macros from photo + transcript
  → row updated to COMPLETE
  → client polls /api/processing and refreshes the timeline when it settles
```

Uploads return in milliseconds rather than blocking on the model. A failed job
lands as `FAILED` with the error on the card and a one-click re-run.

### Notable decisions

- **Voice *or* text.** Every capture form accepts a typed description as well as
  a recording. It is faster in a loud gym, it is the accessibility path, and it
  keeps the product usable when transcription is unavailable.
- **`after()` instead of a queue.** The MVP needs non-blocking uploads, not
  infrastructure. A real queue becomes worthwhile when retries and fan-out
  matter.
- **JWT sessions with the Prisma adapter.** Users and OAuth accounts persist in
  Postgres while sessions stay stateless — the combination the credentials
  provider requires.
- **Athletes can correct the AI.** An estimate the athlete cannot fix is one the
  coach cannot trust.
- **Consistency over precision.** Nutrition runs at `temperature: 0` with a
  fixed seed, and the model must commit to a gram weight for every item using a
  fixed table of household-unit conversions. Nobody weighs a banana, so the
  honest goal is that the same meal always scores the same — a coach reading a
  trend cannot tell sampling noise from a real change. `npm run check:variance`
  measures this: the spread on a repeated meal went from 13.2% to 0.0%.
- **Hand-rolled SVG chart.** One chart does not justify a charting dependency,
  and inline SVG inherits the theme for free.
- **Averages over logged days.** A missed day would otherwise read as a
  starvation day and distort the weekly summary.

---

## Not built yet

From the spec's future list: AI coach insights, WhatsApp intake, wearable
integrations, and body-composition analysis of progress photos. The schema
already carries the data these need.

Also worth doing before real users: rate limiting on the AI endpoints, image
downscaling before upload, and a background queue with retries.
