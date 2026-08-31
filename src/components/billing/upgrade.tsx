"use client";

import * as React from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { useCheckout } from "@/components/billing/use-checkout";
import { PLAN_CARDS } from "@/lib/plans";
import type { PlanTerm } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

/** The plan board's three cards. The payment flow itself lives in useCheckout. */

export function Upgrade({ currentTerm }: { currentTerm: PlanTerm | null }) {
  const { buy, pending } = useCheckout();

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
