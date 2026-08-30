/**
 * Copies the production environment block to the clipboard, ready to paste
 * into Vercel's "Environment Variables" box (it accepts a whole KEY=value
 * block at once).
 *
 *   npm run env:vercel
 *
 * A fresh AUTH_SECRET is generated rather than reusing the development one.
 * Values are never printed — only a masked summary.
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

if (!existsSync(ENV_PATH)) {
  console.error(".env not found.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .map((l) => l.match(/^(\w+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

// Carried over from .env. AUTH_URL and the Google pair are added by hand after
// the first deploy, once Vercel has assigned a URL.
const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "OPENAI_API_KEY",
  "S3_ENDPOINT",
  "S3_REGION",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

const missing = KEYS.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Missing from .env: ${missing.join(", ")}`);
  process.exit(1);
}

const lines = [
  ...KEYS.map((k) => `${k}=${env[k]}`),
  // Never reuse the development secret in production.
  `AUTH_SECRET=${randomBytes(32).toString("base64")}`,
];

const block = lines.join("\n");

try {
  execFileSync("pbcopy", { input: block });
} catch {
  console.error("Could not reach the clipboard (pbcopy). Nothing was printed.");
  process.exit(1);
}

console.log("\nCopied to clipboard — paste into Vercel → Environment Variables:\n");
for (const k of [...KEYS, "AUTH_SECRET"]) {
  const v = k === "AUTH_SECRET" ? "(freshly generated)" : env[k];
  const shown =
    k === "AUTH_SECRET"
      ? v
      : /KEY|SECRET|URL/.test(k) && v.length > 34
        ? `${v.slice(0, 24)}…${v.slice(-6)}`
        : v;
  console.log(`  ${k.padEnd(22)} ${shown}`);
}
console.log(`
Still to add after the first deploy:
  AUTH_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
`);
