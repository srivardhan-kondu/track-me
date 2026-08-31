import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  FREE_HISTORY_DAYS,
  PRICES,
  expiryFor,
  historyDays,
  isPaid,
  isPremium,
  isTrialing,
  planUpdateFor,
  termForAmount,
  trialEndsFrom,
} from "../src/lib/entitlements";
import {
  extractPayment,
  verifyCheckoutSignature,
  verifySignature,
} from "../src/lib/razorpay";

const NOW = new Date("2026-08-31T12:00:00.000Z");
const day = (d: string) => new Date(`${d}T12:00:00.000Z`);

describe("pricing", () => {
  it("maps each list price to its term", () => {
    assert.equal(termForAmount(PRICES.MONTHLY), "MONTHLY");
    assert.equal(termForAmount(PRICES.YEARLY), "YEARLY");
    assert.equal(termForAmount(PRICES.LIFETIME), "LIFETIME");
  });

  it("quotes the prices in paise", () => {
    assert.deepEqual(PRICES, { MONTHLY: 9900, YEARLY: 79900, LIFETIME: 99900 });
  });

  it("refuses any amount that is not a list price", () => {
    // The payment page accepts any figure from ₹1 up, so this is the only
    // thing stopping a ₹1 payment from buying a lifetime plan.
    assert.equal(termForAmount(100), null);
    assert.equal(termForAmount(9899), null);
    assert.equal(termForAmount(100_000), null);
    assert.equal(termForAmount(0), null);
  });
});

describe("expiry", () => {
  it("gives a lifetime plan no expiry", () => {
    assert.equal(expiryFor("LIFETIME", NOW), null);
  });

  it("dates a first purchase from the payment", () => {
    assert.equal(
      expiryFor("MONTHLY", NOW, null)?.toISOString(),
      "2026-09-30T12:00:00.000Z",
    );
    assert.equal(
      expiryFor("YEARLY", NOW, null)?.toISOString(),
      "2027-08-31T12:00:00.000Z",
    );
  });

  it("extends an unexpired plan rather than restarting it", () => {
    // Renewing three days early must not forfeit those three days.
    const current = day("2026-09-03");
    assert.equal(
      expiryFor("MONTHLY", NOW, current)?.toISOString(),
      "2026-10-03T12:00:00.000Z",
    );
  });

  it("restarts from the payment once the old plan has lapsed", () => {
    assert.equal(
      expiryFor("MONTHLY", NOW, day("2026-08-01"))?.toISOString(),
      "2026-09-30T12:00:00.000Z",
    );
  });
});

describe("entitlement", () => {
  const free = { plan: "FREE" as const, planExpiresAt: null, trialEndsAt: null };

  it("keeps a free account out", () => {
    assert.equal(isPremium(free, NOW), false);
  });

  it("lets a trial in without calling it paid", () => {
    const user = { ...free, trialEndsAt: day("2026-09-05") };
    assert.equal(isPremium(user, NOW), true);
    assert.equal(isTrialing(user, NOW), true);
    assert.equal(isPaid(user, NOW), false);
  });

  it("closes an expired trial", () => {
    assert.equal(isPremium({ ...free, trialEndsAt: day("2026-08-20") }, NOW), false);
  });

  it("runs the trial for seven days", () => {
    assert.equal(trialEndsFrom(NOW).toISOString(), "2026-09-07T12:00:00.000Z");
  });

  it("treats a null expiry on a paid plan as lifetime", () => {
    const user = { plan: "PREMIUM" as const, planExpiresAt: null, trialEndsAt: null };
    assert.equal(isPremium(user, NOW), true);
    assert.equal(isPaid(user, NOW), true);
  });

  it("closes a lapsed paid plan", () => {
    const user = {
      plan: "PREMIUM" as const,
      planExpiresAt: day("2026-08-30"),
      trialEndsAt: null,
    };
    assert.equal(isPremium(user, NOW), false);
  });

  it("keeps a lapsed payer in while their trial still runs", () => {
    const user = {
      plan: "PREMIUM" as const,
      planExpiresAt: day("2026-08-30"),
      trialEndsAt: day("2026-09-05"),
    };
    assert.equal(isPremium(user, NOW), true);
  });
});

describe("applying a purchase", () => {
  const free = {
    plan: "FREE" as const,
    planTerm: null,
    planExpiresAt: null,
  };

  it("moves a free account onto the term bought", () => {
    assert.deepEqual(planUpdateFor(free, "YEARLY", NOW), {
      plan: "PREMIUM",
      planTerm: "YEARLY",
      planExpiresAt: new Date("2027-08-31T12:00:00.000Z"),
    });
  });

  it("clears the expiry when a subscriber upgrades to lifetime", () => {
    const yearly = {
      plan: "PREMIUM" as const,
      planTerm: "YEARLY" as const,
      planExpiresAt: day("2027-01-01"),
    };
    assert.deepEqual(planUpdateFor(yearly, "LIFETIME", NOW), {
      plan: "PREMIUM",
      planTerm: "LIFETIME",
      planExpiresAt: null,
    });
  });

  it("never writes an expiry over a lifetime plan", () => {
    const lifetime = {
      plan: "PREMIUM" as const,
      planTerm: "LIFETIME" as const,
      planExpiresAt: null,
    };
    assert.equal(planUpdateFor(lifetime, "MONTHLY", NOW), null);
  });
});

describe("webhook signatures", () => {
  const SECRET = "whsec_example";
  const body = JSON.stringify({ event: "payment.captured" });
  const sign = (payload: string, secret = SECRET) =>
    createHmac("sha256", secret).update(payload).digest("hex");

  it("accepts a correctly signed body", () => {
    assert.equal(verifySignature(body, sign(body), SECRET), true);
  });

  it("rejects a tampered body", () => {
    const tampered = body.replace("captured", "failed");
    assert.equal(verifySignature(tampered, sign(body), SECRET), false);
  });

  it("rejects a signature made with another secret", () => {
    assert.equal(verifySignature(body, sign(body, "wrong"), SECRET), false);
  });

  it("rejects a missing, short or non-hex signature", () => {
    assert.equal(verifySignature(body, null, SECRET), false);
    assert.equal(verifySignature(body, "", SECRET), false);
    assert.equal(verifySignature(body, "abcd", SECRET), false);
    assert.equal(verifySignature(body, "zzzz", SECRET), false);
  });

  it("is sensitive to re-serialised JSON", () => {
    // Why the route hashes the raw text: re-encoding reorders nothing here but
    // does change whitespace, and the digest moves with it.
    const respaced = JSON.stringify(JSON.parse(body), null, 2);
    assert.equal(verifySignature(respaced, sign(body), SECRET), false);
  });
});

describe("payload extraction", () => {
  const entity = {
    id: "pay_TUiZabc123",
    amount: 99900,
    currency: "INR",
    email: "billing@example.com",
    contact: "+919000090000",
    notes: { comment: "signed up as Athlete@Example.com" },
    created_at: 1_787_817_083,
  };

  it("reads a payment.captured body", () => {
    const p = extractPayment({
      event: "payment.captured",
      payload: { payment: { entity } },
    });
    assert.equal(p?.id, "pay_TUiZabc123");
    assert.equal(p?.amount, 99900);
    assert.equal(p?.contact, "+919000090000");
    assert.equal(p?.note, "signed up as Athlete@Example.com");
    assert.equal(p?.paidAt.toISOString(), "2026-08-27T07:51:23.000Z");
  });

  it("reads a payment_link.paid body identically", () => {
    // Both events are subscribed to, so one purchase can arrive twice; they
    // must resolve to the same payment id for the duplicate check to catch it.
    const captured = extractPayment({
      event: "payment.captured",
      payload: { payment: { entity } },
    });
    const linked = extractPayment({
      event: "payment_link.paid",
      payload: { payment_link: { entity: { id: "pl_x" } }, payment: { entity } },
    });
    assert.equal(captured?.id, linked?.id);
  });

  it("prefers an email typed into the form over the billing address", () => {
    const p = extractPayment({
      event: "payment.captured",
      payload: { payment: { entity } },
    });
    assert.deepEqual(p?.candidateEmails, [
      "athlete@example.com",
      "billing@example.com",
    ]);
  });

  it("falls back to the billing address when no note holds an email", () => {
    const p = extractPayment({
      event: "payment.captured",
      payload: { payment: { entity: { ...entity, notes: { comment: "thanks!" } } } },
    });
    assert.deepEqual(p?.candidateEmails, ["billing@example.com"]);
  });

  it("ignores events it does not handle", () => {
    assert.equal(
      extractPayment({ event: "payment.failed", payload: { payment: { entity } } }),
      null,
    );
    assert.equal(extractPayment({ event: "payment.captured" }), null);
    assert.equal(extractPayment({}), null);
    assert.equal(extractPayment(null), null);
  });

  it("rejects an entity with no id or amount", () => {
    assert.equal(
      extractPayment({
        event: "payment.captured",
        payload: { payment: { entity: { amount: 9900 } } },
      }),
      null,
    );
    assert.equal(
      extractPayment({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_x" } } },
      }),
      null,
    );
  });
});

describe("checkout signatures", () => {
  // Checkout signs "order_id|payment_id" with the API key secret — a different
  // scheme and a different secret from the webhook's body digest.
  const SECRET = "test_key_secret";
  const ORDER = "order_TUiZabc123";
  const PAYMENT = "pay_TUiZdef456";
  const sign = (order: string, payment: string, secret = SECRET) =>
    createHmac("sha256", secret).update(`${order}|${payment}`).digest("hex");

  it("accepts the pair Razorpay signed", () => {
    const sig = sign(ORDER, PAYMENT);
    assert.equal(verifyCheckoutSignature(ORDER, PAYMENT, sig, SECRET), true);
  });

  it("rejects a payment id swapped onto another order", () => {
    const sig = sign(ORDER, PAYMENT);
    assert.equal(
      verifyCheckoutSignature("order_someoneelse", PAYMENT, sig, SECRET),
      false,
    );
    assert.equal(
      verifyCheckoutSignature(ORDER, "pay_someoneelse", sig, SECRET),
      false,
    );
  });

  it("rejects a signature made with another secret", () => {
    const sig = sign(ORDER, PAYMENT, "not_the_secret");
    assert.equal(verifyCheckoutSignature(ORDER, PAYMENT, sig, SECRET), false);
  });

  it("rejects an empty signature or a missing secret", () => {
    assert.equal(verifyCheckoutSignature(ORDER, PAYMENT, "", SECRET), false);
    assert.equal(verifyCheckoutSignature(ORDER, PAYMENT, sign(ORDER, PAYMENT), ""), false);
  });

  it("does not accept a webhook-style body digest", () => {
    // The two schemes must not be interchangeable, or a leaked webhook secret
    // would be enough to mint access.
    const bodyDigest = createHmac("sha256", SECRET)
      .update(JSON.stringify({ order_id: ORDER, payment_id: PAYMENT }))
      .digest("hex");
    assert.equal(
      verifyCheckoutSignature(ORDER, PAYMENT, bodyDigest, SECRET),
      false,
    );
  });
});

describe("checkout payloads", () => {
  it("reads the account off a Checkout order's notes", () => {
    const p = extractPayment({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_x",
            amount: 79900,
            currency: "INR",
            order_id: "order_x",
            notes: { userId: "cuid_abc", term: "YEARLY" },
            created_at: 1_787_817_083,
          },
        },
      },
    });
    assert.equal(p?.userId, "cuid_abc");
    assert.equal(p?.orderId, "order_x");
  });

  it("leaves userId null for a payment page purchase", () => {
    const p = extractPayment({
      event: "payment_link.paid",
      payload: {
        payment: {
          entity: {
            id: "pay_y",
            amount: 9900,
            currency: "INR",
            email: "a@b.com",
            notes: { comment: "hello" },
          },
        },
      },
    });
    assert.equal(p?.userId, null);
    assert.equal(p?.orderId, null);
    assert.deepEqual(p?.candidateEmails, ["a@b.com"]);
  });
});

describe("the free history window", () => {
  it("gives a paying account whatever it asked for", () => {
    assert.equal(historyDays(true, 365), 365);
    assert.equal(historyDays(true, 30), 30);
  });

  it("narrows anything longer for a free account", () => {
    assert.equal(historyDays(false, 365), FREE_HISTORY_DAYS);
    assert.equal(historyDays(false, 35), FREE_HISTORY_DAYS);
  });

  it("never widens a shorter window", () => {
    // A page asking for 3 days must not be handed 7 just because the account
    // is entitled to them.
    assert.equal(historyDays(false, 3), 3);
    assert.equal(historyDays(true, 3), 3);
  });

  it("is seven days", () => {
    assert.equal(FREE_HISTORY_DAYS, 7);
  });
});
