# Deploying Track Me

Target: **Vercel** (hosting) + **Neon** (database) + **Cloudflare R2** (media).

Two services are optional in development but **required in production**:

| Service           | Why it becomes mandatory                                                       |
| ----------------- | ------------------------------------------------------------------------------ |
| **Google OAuth**  | The development sign-in does not exist in a production build — without Google there is no way to sign in at all. |
| **Cloudflare R2** | Serverless filesystems are read-only and discarded between requests, so the local `.uploads/` driver cannot work. |

Uploads will throw a clear, named error if R2 is missing rather than failing obscurely.

---

## Order matters

Google needs your deployed URL before it will issue a working redirect, and
Vercel needs Google's credentials before sign-in works. So:

**deploy first → collect the URL → add Google → redeploy.**

Trying to do it in one pass is the usual reason a first deploy ends in
`redirect_uri_mismatch`.

---

## 1. Push the code

```bash
gh auth login                  # HTTPS, authenticate in browser
cd "/Users/srivardhan/Track Me"
git push -u origin main
```

## 2. Cloudflare R2

1. **https://dash.cloudflare.com** → **R2** → *Create bucket* (e.g. `trackme-media`).
   Leave it **private** — the app signs its own URLs.
2. **R2** → *Manage R2 API Tokens* → *Create API token*
   - Permission: **Object Read & Write**
   - Scope it to the bucket you just made
3. Copy the **Access Key ID** and **Secret Access Key** (shown once).
4. Your **Account ID** is on the R2 overview page.

No CORS configuration is needed: uploads pass through the server, not the browser.

> **R2 requires a payment method** on file to enable, even on the free tier.
> If you would rather not add one, any S3-compatible store works — set
> `S3_ENDPOINT` (and `S3_REGION`) instead of `R2_ACCOUNT_ID`, keeping the same
> `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` variables.
> **Neon Object Storage** (public beta, `us-east-2` only) is the natural fit if
> your database is already on Neon — buckets branch with the database:
>
> ```
> S3_ENDPOINT   https://br-<branch-id>.storage.c-2.us-east-2.aws.neon.tech
> S3_REGION     us-east-2
> R2_BUCKET     trackme-media
> R2_ACCESS_KEY_ID      <token_id, nak_live_...>
> R2_SECRET_ACCESS_KEY  <s3_secret_access_key, nsk_live_...>
> ```
>
> Create the bucket with `neon buckets create trackme-media`, and the credential
> from the Neon Console: select the branch, **Credentials** → **Create
> credential** with the `storage:read` and `storage:write` scopes. Both secrets
> are shown once only.
>
> **Supabase Storage** is another no-card option:
>
> ```
> S3_ENDPOINT   https://<project-ref>.supabase.co/storage/v1/s3
> S3_REGION     <your project region, e.g. us-east-1>
> R2_BUCKET     trackme-media
> R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY   from Storage → S3 Access Keys
> ```

Keep the media bucket **private**. Meal photos, progress photos and voice notes
are always served through presigned URLs valid for one hour — never through a
public link. `PUBLIC_ASSET_BASE_URL` exists for assets that are genuinely
public and must not be pointed at the media bucket: an unauthenticated CDN URL
never expires and cannot be revoked, and the object keys are not secret, since
the data export returns them in plaintext.

## 3. Generate an auth secret

```bash
openssl rand -base64 32
```

Keep it — it goes into Vercel as `AUTH_SECRET`. Do not reuse the development one.

## 4. Deploy to Vercel

1. **https://vercel.com/new** → import `srivardhan-kondu/track-me`
2. Framework preset is detected as Next.js. Leave the build settings alone —
   `npm run build` already runs `prisma generate`.
3. Add environment variables (Production, Preview, Development):

   ```
   DATABASE_URL      <Neon pooled URL — hostname contains "-pooler">
   DIRECT_URL        <Neon direct URL — same, without "-pooler">
   AUTH_SECRET       <from step 3>
   OPENAI_API_KEY    <your key>
   R2_ACCOUNT_ID     <from step 2>
   R2_ACCESS_KEY_ID  <from step 2>
   R2_SECRET_ACCESS_KEY <from step 2>
   R2_BUCKET         trackme-media
   ```

   Leave `AUTH_URL`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` out for now.

4. **Deploy.** It will build and come up. Sign-in will not work yet — expected.
5. Note the URL, e.g. `https://track-me-xyz.vercel.app`.

## 5. Google OAuth

1. **https://console.cloud.google.com** → create a project.
2. *APIs & Services* → **OAuth consent screen**
   - User type: **External**
   - Fill in app name, user support email, developer contact
   - Scopes: the defaults (`email`, `profile`) are enough
   - While the app is in **Testing**, only accounts listed under **Test users**
     can sign in. Add yourself and your athletes, or **Publish** the app.
3. *APIs & Services* → **Credentials** → *Create credentials* → **OAuth client ID**
   - Application type: **Web application**
   - Authorised JavaScript origins: `https://track-me-xyz.vercel.app`
   - Authorised redirect URIs:
     `https://track-me-xyz.vercel.app/api/auth/callback/google`
   
   The redirect URI must match **exactly** — scheme, host, and path, no
   trailing slash.
4. Copy the client ID and secret.

## 6. Add Google to Vercel and redeploy

Add three more variables:

```
AUTH_URL           https://track-me-xyz.vercel.app
AUTH_GOOGLE_ID     <client id>
AUTH_GOOGLE_SECRET <client secret>
```

Then *Deployments* → latest → **Redeploy**. Environment changes do not apply
until a redeploy.

## 7. Verify

Visit the URL and sign in with Google. Then check:

- `/dashboard/settings` → **Integrations** should show all three as configured
- Log a meal with a photo and a voice note; confirm macros appear within a few
  seconds and the photo renders (that proves R2 round-trips)
- Switch to **Coach** mode and confirm the roster loads

### Clearing the demo data

The database still holds the seeded coach and athletes. Before real use:

```bash
npx prisma studio        # delete the three @trackme.dev users
```

Deleting a user cascades to their meals, workouts, weigh-ins and photos.

---

## Notes and limits

**Request body cap.** Vercel rejects request bodies over 4.5 MB. The client
downscales images to a 1600 px longest edge before upload (typically under
500 KB), and `bodySizeLimit` is set to 4 MB as a backstop.

**Function duration.** AI processing runs in `after()`, after the response is
sent, but still counts toward the function's execution time. The meal and
workout routes declare `maxDuration = 60`, the Hobby-plan ceiling. Whisper plus
Vision typically completes in 6–8 seconds.

**Database connections.** Use the **pooled** Neon URL for `DATABASE_URL`;
serverless functions open many short-lived connections and will exhaust a
direct connection limit. `DIRECT_URL` is only used by `prisma db push`.

**Schema changes.** Your Neon database already has the schema. After changing
`schema.prisma`, run `npm run db:push` locally against production before
deploying code that depends on it.

**Cost.** Neon, Vercel Hobby and R2 all have free tiers that comfortably fit an
MVP. OpenAI is the only metered cost — roughly a fraction of a cent per meal
(one Whisper call plus one Vision call).

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `redirect_uri_mismatch` | The Google redirect URI does not exactly match `https://<domain>/api/auth/callback/google`. |
| Sign-in button missing | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` unset. A production build has no other provider by design. |
| `Access blocked: app not verified` | The consent screen is in Testing and the account is not a listed test user. |
| Upload fails with a storage error | R2 variables missing or the token lacks Object Read & Write on that bucket. |
| `Error: P1001 can't reach database` | Wrong `DATABASE_URL`, or `sslmode=require` missing. |
| Photos 404 after upload | Bucket credentials lack read access, or the key was written to a different bucket than the one being read. |
| Meals stay on "Analysing" | The job queue is not being drained. Check `CRON_SECRET` is set and the Vercel Cron for `/api/jobs/run` is registered; call it by hand with `Authorization: Bearer $CRON_SECRET` to see the queue state. |
| Macros never arrive | `OPENAI_API_KEY` unset or out of credit — check the function logs. |

## Background jobs

The two OpenAI calls a meal or workout needs — transcription and analysis — run
as queued jobs rather than inside the upload request. The upload enqueues,
tries the job inline so an ordinary log still feels instant, and returns; a
Vercel Cron drains whatever the inline attempt could not finish.

Set before deploying:

```
CRON_SECRET       openssl rand -hex 32
AI_MAX_IN_FLIGHT  20 by default; size it to your OpenAI tier
```

`vercel.json` registers the daily cron. Vercel sends the secret as a
bearer token automatically; nothing else may call the endpoint.

Without `CRON_SECRET` the worker refuses every request, and any job the inline
attempt fails to finish — a killed invocation, a rate-limited OpenAI call —
stays queued with nothing to pick it up. Check it is set.

## The OpenAI budget

`AI_DAILY_BUDGET_USD` is a hard ceiling on what the key may spend in a day.
Past it, queued analysis is parked until the window rolls over rather than run
or failed — logging keeps working and the macros arrive the next day.

This is the limit that matters at scale. The per-user rate limits bound what
one athlete can do; they do nothing about ten thousand athletes each doing
their allowance, and every sign-up gets a seven-day trial, so "users" means
sign-ups rather than customers. Sixty AI logs a day across ten thousand trial
accounts is roughly 600,000 model calls.

Spend is recorded from the usage the API reports back, in tenths of a cent, and
the current figure comes back on every worker pass:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/run
# { ..., "budget": { "spentUsd": 3.184, "budgetUsd": 25, "exhausted": false } }
```

Start low, watch that number for a week, and raise it knowingly.

One rule when working on `src/services/ai/`: **those modules must not import
anything that reaches the Prisma client.** The client reads `.env` when it
initialises, and `aiEnabled` is derived from `OPENAI_API_KEY` — so a database
import in that graph silently switches the offline fallback off and makes the
test suite spend real money against the production key. The cost maths lives in
`pricing.ts`, which imports nothing; the ledger lives in `budget.ts`, which is
only touched by callers that already have a database. `tests/ai-isolation.test.ts`
enforces the split.

## Rate limits

Every limited surface is declared in one place, `src/lib/rate-limit.ts`, keyed
by user id wherever there is a session. Windows are stored in Postgres and
swept by the job worker.

The one limit that is **not** in application code is the global per-IP ceiling:
rejecting a flood in a route handler still costs a function invocation, so it
belongs at the edge. Configure it in **Vercel → Firewall** — 300 requests per
minute per IP is a reasonable starting point, above anything a real client
does. Vercel's managed DDoS protection sits in front of that.
