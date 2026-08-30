/**
 * Points .env at a hosted Postgres database.
 *
 *   node scripts/set-db-url.mjs
 *
 * Reads the connection string from stdin so it never lands in shell history,
 * derives the pooled/direct pair where the provider allows it, and rewrites
 * only the two database lines in .env.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the project path may contain spaces.
const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

function classify(raw) {
  const u = new URL(raw);
  const host = u.hostname;

  // Neon distinguishes the pooled endpoint purely by a "-pooler" host suffix,
  // so the counterpart URL can be derived from either one.
  if (host.endsWith(".neon.tech")) {
    const direct = new URL(raw);
    const pooled = new URL(raw);
    direct.hostname = host.replace("-pooler", "");
    pooled.hostname = host.includes("-pooler")
      ? host
      : host.replace(/^(ep-[^.]+)/, "$1-pooler");
    return { provider: "Neon", pooled: pooled.href, direct: direct.href };
  }

  // Supabase uses different hosts for the pooler and the direct server, so the
  // two cannot be derived from one another.
  if (host.includes("supabase")) {
    return { provider: "Supabase", pooled: raw, direct: raw, ambiguous: true };
  }

  return { provider: "Postgres", pooled: raw, direct: raw };
}

function ensureSsl(raw) {
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  if (!local && !u.searchParams.has("sslmode")) {
    u.searchParams.set("sslmode", "require");
  }
  return u.href;
}

function setLine(body, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(body) ? body.replace(re, line) : `${body}\n${line}`;
}

const rl = createInterface({ input: process.stdin, output: process.stderr });

const raw = (
  await rl.question("Paste your Postgres connection string:\n> ")
).trim();
rl.close();

if (!raw) {
  console.error("\nNothing entered — .env unchanged.");
  process.exit(1);
}

let info;
try {
  info = classify(raw);
} catch {
  console.error("\nThat is not a valid connection URL. Nothing was changed.");
  process.exit(1);
}

if (!existsSync(ENV_PATH)) {
  console.error("\n.env not found. Copy .env.example to .env first.");
  process.exit(1);
}

// Keep a copy so a mistake here is trivially reversible.
copyFileSync(ENV_PATH, `${ENV_PATH}.bak`);

let body = readFileSync(ENV_PATH, "utf8");
body = setLine(body, "DATABASE_URL", ensureSsl(info.pooled));
body = setLine(body, "DIRECT_URL", ensureSsl(info.direct));
writeFileSync(ENV_PATH, body);

const shown = new URL(info.pooled);
console.error(`
Provider detected: ${info.provider}
Host:              ${shown.hostname}
Database:          ${shown.pathname.slice(1)}

Previous .env saved as .env.bak
`);

if (info.ambiguous) {
  console.error(
    `Supabase uses separate hosts for pooling and direct access, so both URLs
were set to the string you pasted. If you gave the pooled one (port 6543),
open .env and set DIRECT_URL to the direct string (port 5432) as well.
`,
  );
}

console.error("Next:  npm run db:setup\n");
