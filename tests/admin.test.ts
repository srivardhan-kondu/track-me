import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  accountState,
  adminEmails,
  budgetHealth,
  emailIsAdmin,
  grantsAdmin,
  inr,
  inrShort,
  monthlyValuePaise,
  pageParam,
  paginate,
  queueHealth,
  spendDay,
} from "../src/lib/admin";
import { PRICES } from "../src/lib/entitlements";

const NOW = new Date("2026-08-31T12:00:00.000Z");
const day = (d: string) => new Date(`${d}T12:00:00.000Z`);

const originalAllowlist = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (originalAllowlist === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAllowlist;
});

describe("who is an admin", () => {
  it("reads the allowlist at call time, not at import", () => {
    delete process.env.ADMIN_EMAILS;
    assert.deepEqual(adminEmails(), []);

    // The console is imported once and lives for the life of the process; an
    // allowlist frozen at module load would ignore a redeploy's new value.
    process.env.ADMIN_EMAILS = "ops@example.com";
    assert.deepEqual(adminEmails(), ["ops@example.com"]);
  });

  it("accepts commas, spaces and mixed case", () => {
    process.env.ADMIN_EMAILS = "A@example.com, b@example.com  c@example.com";
    assert.deepEqual(adminEmails(), [
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
    assert.equal(emailIsAdmin("B@Example.com"), true);
  });

  it("ignores entries that are not addresses", () => {
    process.env.ADMIN_EMAILS = "not-an-email,,   ,real@example.com";
    assert.deepEqual(adminEmails(), ["real@example.com"]);
  });

  it("never treats a missing email as allowlisted", () => {
    process.env.ADMIN_EMAILS = "ops@example.com";
    assert.equal(emailIsAdmin(null), false);
    assert.equal(emailIsAdmin(""), false);
    assert.equal(emailIsAdmin(undefined), false);
  });

  it("grants on either the column or the allowlist", () => {
    process.env.ADMIN_EMAILS = "ops@example.com";

    assert.equal(grantsAdmin({ email: "ops@example.com", isAdmin: false }), true);
    assert.equal(grantsAdmin({ email: "someone@else.com", isAdmin: true }), true);
    assert.equal(grantsAdmin({ email: "someone@else.com", isAdmin: false }), false);
    // The way back in after a restore drops the column but keeps the env.
    assert.equal(grantsAdmin({ email: null, isAdmin: false }), false);
  });
});

describe("account state", () => {
  const base = { plan: "FREE" as const, planExpiresAt: null, trialEndsAt: null };

  it("separates paying from trialing", () => {
    assert.equal(
      accountState(
        { ...base, plan: "PREMIUM", planExpiresAt: day("2026-12-01") },
        NOW,
      ),
      "PAID",
    );
    assert.equal(
      accountState({ ...base, trialEndsAt: day("2026-09-04") }, NOW),
      "TRIAL",
    );
  });

  it("calls a lifetime plan paid, expiry or not", () => {
    assert.equal(
      accountState({ ...base, plan: "PREMIUM", planExpiresAt: null }, NOW),
      "PAID",
    );
  });

  it("separates a lapsed trial from an account that never had one", () => {
    assert.equal(
      accountState({ ...base, trialEndsAt: day("2026-08-01") }, NOW),
      "LAPSED",
    );
    assert.equal(accountState(base, NOW), "FREE");
  });

  it("counts an expired paid plan as lapsed, not paying", () => {
    assert.equal(
      accountState(
        {
          plan: "PREMIUM",
          planExpiresAt: day("2026-08-01"),
          trialEndsAt: day("2026-07-01"),
        },
        NOW,
      ),
      "LAPSED",
    );
  });
});

describe("recurring revenue", () => {
  it("spreads a yearly plan across the months it covers", () => {
    assert.equal(monthlyValuePaise("YEARLY"), Math.round(PRICES.YEARLY / 12));
  });

  it("counts a monthly plan at its list price", () => {
    assert.equal(monthlyValuePaise("MONTHLY"), PRICES.MONTHLY);
  });

  it("counts lifetime as no recurring revenue at all", () => {
    // Bought once. Booking it as monthly income would put a number on the
    // dashboard that never arrives again.
    assert.equal(monthlyValuePaise("LIFETIME"), 0);
    assert.equal(monthlyValuePaise(null), 0);
  });
});

describe("money formatting", () => {
  it("reports paise as rupees", () => {
    assert.equal(inr(PRICES.MONTHLY), "₹99");
    assert.equal(inr(0), "₹0");
  });

  it("shortens larger figures without inventing precision", () => {
    assert.equal(inrShort(500_00), "₹500");
    assert.equal(inrShort(45_000_00), "₹45.0k");
    assert.equal(inrShort(2_50_000_00), "₹2.5L");
  });
});

describe("queue health", () => {
  const idle = { queued: 0, running: 0, failed: 0, oldestQueuedSec: 0 };

  it("is quiet when there is nothing to do", () => {
    assert.deepEqual(queueHealth(idle), { tone: "ok", label: "Idle" });
  });

  it("does not call an ordinary backlog a fault", () => {
    assert.equal(
      queueHealth({ ...idle, queued: 4, oldestQueuedSec: 30 }).tone,
      "ok",
    );
  });

  it("escalates on a wait no schedule explains", () => {
    assert.equal(
      queueHealth({ ...idle, queued: 4, oldestQueuedSec: 1200 }).tone,
      "warn",
    );
    assert.equal(
      queueHealth({ ...idle, queued: 4, oldestQueuedSec: 7200 }).tone,
      "bad",
    );
  });

  it("treats an exhausted job as the worst case, whatever else is true", () => {
    // Nothing will pick these up again — that is the point of the state.
    assert.equal(queueHealth({ ...idle, failed: 1 }).tone, "bad");
  });
});

describe("budget health", () => {
  it("warns before the money is gone, not after", () => {
    assert.equal(budgetHealth(10, 25).tone, "ok");
    assert.equal(budgetHealth(21, 25).tone, "warn");
    assert.equal(budgetHealth(25, 25).tone, "bad");
  });

  it("survives a budget of zero", () => {
    assert.equal(budgetHealth(0, 0).tone, "ok");
  });
});

describe("paging", () => {
  it("describes the window it is showing", () => {
    const page = paginate(120, 2, 25);
    assert.equal(page.skip, 25);
    assert.equal(page.from, 26);
    assert.equal(page.to, 50);
    assert.equal(page.pages, 5);
    assert.ok(page.hasPrev && page.hasNext);
  });

  it("clamps a page past the end back to the last one", () => {
    // A URL somebody typed, or a filter that narrowed under them.
    const page = paginate(30, 99, 25);
    assert.equal(page.page, 2);
    assert.equal(page.from, 26);
    assert.equal(page.to, 30);
    assert.equal(page.hasNext, false);
  });

  it("reports an empty result without claiming a row", () => {
    const page = paginate(0, 1, 25);
    assert.equal(page.pages, 1);
    assert.equal(page.from, 0);
    assert.equal(page.to, 0);
  });

  it("refuses a page number that is not one", () => {
    assert.equal(pageParam(undefined), 1);
    assert.equal(pageParam("0"), 1);
    assert.equal(pageParam("-4"), 1);
    assert.equal(pageParam("nonsense"), 1);
    assert.equal(pageParam("3"), 3);
  });
});

describe("spend ledger keys", () => {
  it("reads the date out of a spend key", () => {
    assert.equal(spendDay("ai-spend:2026-08-31"), "2026-08-31");
  });

  it("ignores every other bucket in the same table", () => {
    // The ledger shares the rate-limit table; a prefix scan must not mistake
    // a limiter window for a day of spend.
    assert.equal(spendDay("aiCreate:user_123:1756636800000"), null);
    assert.equal(spendDay("ai-spend:not-a-date"), null);
  });
});
