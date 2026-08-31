"use client";

import { Loader2 } from "lucide-react";

import { useCheckout } from "@/components/billing/use-checkout";
import { Button } from "@/components/ui/button";
import type { PlanTerm } from "@/lib/entitlements";

/**
 * Opens the payment sheet directly, from wherever the athlete already is.
 *
 * The label states the price, because this button charges rather than
 * navigates: nobody should reach Razorpay's sheet and meet a figure they were
 * not shown first.
 */
export function CheckoutButton({
  term,
  label,
  variant = "default",
  size = "sm",
  className,
}: {
  term: PlanTerm;
  label: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const { buy, pending } = useCheckout();
  const busy = pending === term;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending !== null}
      onClick={() => buy(term)}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {busy ? "Opening…" : label}
    </Button>
  );
}
