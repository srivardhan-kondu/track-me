import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

/** Prisma error codes worth retrying: the server was unreachable. */
const TRANSIENT = new Set(["P1001", "P1002", "P1008", "P1017"]);
const MAX_ATTEMPTS = 3;

function isTransient(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return typeof code === "string" && TRANSIENT.has(code);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends({
    query: {
      /**
       * Serverless Postgres (Neon, and similar) suspends its compute when
       * idle. The first query after that wakes it but can fail outright while
       * it starts. Retrying briefly turns a user-visible error into a slightly
       * slow request; anything that is not a connectivity fault is rethrown
       * untouched.
       */
      async $allOperations({ query, args }) {
        let lastError: unknown;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
            lastError = err;
            // 250ms, then 1s — a cold start usually completes inside this.
            await sleep(attempt === 1 ? 250 : 1000);
          }
        }

        throw lastError;
      },
    },
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
