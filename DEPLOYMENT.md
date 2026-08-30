# Deploying GymOS

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

1. **https://dash.cloudflare.com** → **R2** → *Create bucket* (e.g. `gymos-media`).
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
> **Supabase Storage** is the easiest no-card option:
>
> ```
> S3_ENDPOINT   https://<project-ref>.supabase.co/storage/v1/s3
> S3_REGION     <your project region, e.g. us-east-1>
> R2_BUCKET     gymos-media
> R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY   from Storage → S3 Access Keys
> ```

`R2_PUBLIC_BASE_URL` is optional. Leave it blank and the app issues presigned
URLs valid for one hour. Set it only if you attach a public custom domain to
the bucket.

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
   R2_BUCKET         gymos-media
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
npx prisma studio        # delete the three @gymos.dev users
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
| Photos 404 after upload | `R2_PUBLIC_BASE_URL` points at a bucket without a public custom domain. Clear it to fall back to presigned URLs. |
| Macros never arrive | `OPENAI_API_KEY` unset or out of credit — check the function logs. |
