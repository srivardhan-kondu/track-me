import { timingSafeEqual } from "node:crypto";

/**
 * The check every scheduled endpoint makes: `Authorization: Bearer
 * $CRON_SECRET`, compared in constant time so the secret cannot be found one
 * character at a time. No secret configured means nobody gets in.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
