"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PLAN_CARDS } from "@/lib/plans";
import type { PlanTerm } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

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
        description: PLAN_CARDS.find((p) => p.term === term)!.name,
        prefill: order.prefill,
        // Matches the violet the rest of the interface reserves for actions.
        theme: { color: "#9878e6" },
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
    <div className="grid gap-3.5 sm:grid-cols-3">
      {PLAN_CARDS.map((plan) => {
        const current = currentTerm === plan.term;
        const busy = pending === plan.term;

        return (
          <button
            key={plan.term}
            type="button"
            onClick={() => buy(plan.term)}
            disabled={pending !== null}
            aria-pressed={current}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-[18px] border p-4 text-left",
              "transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
              "hover:-translate-y-[3px] hover:border-accent hover:shadow-[0_16px_36px_-18px_var(--accent-glow)]",
              "disabled:pointer-events-none disabled:opacity-60",
              plan.featured
                ? "accent-gradient border-accent-line"
                : "border-line-strong bg-surface-raised",
              current && "border-accent ring-1 ring-accent",
            )}
          >
            {/* A violet wash that lifts out of the top edge on hover. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-20 h-32 bg-[radial-gradient(60%_100%_at_50%_100%,var(--accent-glow),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />

            <span className="relative flex items-start justify-between gap-2">
              <span className="mono-label">{plan.name}</span>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-dim" />
              ) : current ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-line/70 bg-accent-soft px-2 py-[3px] text-[10px] font-medium leading-none text-accent-text">
                  <Check className="h-3 w-3" /> Current
                </span>
              ) : plan.ribbon ? (
                <span
                  className={cn(
                    "rounded-full border px-2 py-[3px] text-[10px] font-medium leading-none",
                    plan.featured
                      ? "border-accent-line bg-accent-soft text-accent-text"
                      : "border-line bg-surface-inset text-fg-muted",
                  )}
                >
                  {plan.ribbon}
                </span>
              ) : null}
            </span>

            <span className="relative mt-3 flex items-baseline gap-1.5">
              <span className="font-serif text-[30px] leading-none text-fg">
                {plan.price}
              </span>
              <span className="text-[11.5px] text-fg-dim">{plan.cadence}</span>
            </span>

            <span className="relative mt-2.5 flex-1 text-[11.5px] leading-relaxed text-fg-dim">
              {plan.blurb}
            </span>

            <span
              className={cn(
                "relative mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors",
                current ? "text-fg-muted" : "text-accent-text",
              )}
            >
              {current ? "Extend this plan" : busy ? "Opening…" : "Choose"}
              {!busy && (
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
