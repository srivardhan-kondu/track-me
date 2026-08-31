"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ChoiceTile } from "@/components/ui/choice";
import type { PlanTerm } from "@/lib/entitlements";

/**
 * The in-app payment sheet.
 *
 * Picking a plan asks our server for an order — the price is set there, never
 * here — then hands the order to Razorpay's hosted sheet, which overlays the
 * app rather than navigating away from it. The sheet reports back three ids,
 * and /api/checkout/verify turns them into access.
 */

type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  theme: { color: string };
  handler: (r: CheckoutResult) => void;
  modal: { ondismiss: () => void };
};

type CheckoutResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => {
      open: () => void;
      on: (event: string, handler: (e: unknown) => void) => void;
    };
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/** Loads the sheet once, on first use rather than on every page view. */
function loadCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject());
      return;
    }

    const el = document.createElement("script");
    el.src = SCRIPT;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject();
    document.body.appendChild(el);
  });
}

const PLANS: { term: PlanTerm; title: string; blurb: string }[] = [
  {
    term: "MONTHLY",
    title: "₹99 / month",
    blurb: "Everything premium. Cancel by simply not renewing.",
  },
  {
    term: "YEARLY",
    title: "₹799 / year",
    blurb: "Works out at about ₹66 a month — two months free.",
  },
  {
    term: "LIFETIME",
    title: "₹999 once",
    blurb: "Founder's plan. Paid once, yours permanently.",
  },
];

export function Upgrade({ currentTerm }: { currentTerm: PlanTerm | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PlanTerm | null>(null);

  async function buy(term: PlanTerm) {
    if (pending) return;
    setPending(term);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ term }),
      });
      const order = await res.json();

      if (!res.ok) throw new Error(order.error ?? "Could not start the payment");

      await loadCheckout().catch(() => {
        throw new Error("Could not reach Razorpay. Check your connection.");
      });
      if (!window.Razorpay) throw new Error("Razorpay failed to load");

      const sheet = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Track Me",
        description: PLANS.find((p) => p.term === term)!.title,
        prefill: order.prefill,
        // Matches the amber the rest of the interface reserves for actions.
        theme: { color: "#c8862c" },
        handler: (result) => void confirm(result),
        // Closing the sheet is not a failure; the payment simply did not start.
        modal: { ondismiss: () => setPending(null) },
      });

      sheet.on("payment.failed", () => {
        setPending(null);
        toast.error("The payment did not go through. Nothing was charged.");
      });

      sheet.open();
    } catch (err) {
      setPending(null);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function confirm(result: CheckoutResult) {
    try {
      const res = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Could not confirm the payment");

      if (data.outcome === "pending") {
        // Money is held but not captured, so access is not ours to grant yet.
        toast.success("Payment received — unlocking shortly.");
      } else {
        toast.success("You're on Premium.");
      }
      router.refresh();
    } catch {
      // The webhook is the authoritative path and will still land, so this is
      // a slow unlock rather than a lost payment.
      toast.error("Payment taken, but confirming it failed. It will unlock shortly.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PLANS.map((plan) => (
        <ChoiceTile
          key={plan.term}
          title={plan.title}
          blurb={plan.blurb}
          selected={currentTerm === plan.term}
          disabled={pending !== null}
          onClick={() => buy(plan.term)}
          adornment={
            pending === plan.term ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-dim" />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
