"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { claimPayment, ignorePayment } from "@/app/actions/admin";
import { useAdminAction } from "@/components/admin/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Attributes an unmatched payment to whoever actually paid it.
 *
 * Money taken through the razorpay.me page carries no account id — the payer
 * types whatever email they like into a comment box — so this is the counter
 * where a "I paid and got nothing" support mail is settled. The address is
 * pre-filled with the one on the payment, which is right often enough to be
 * worth offering and wrong often enough to be editable.
 */
export function ClaimPayment({
  paymentId,
  suggested,
}: {
  paymentId: string;
  suggested: string | null;
}) {
  const { pending, run } = useAdminAction();
  const [email, setEmail] = React.useState(suggested ?? "");

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          claimPayment,
          { paymentId, email },
          { success: "Payment attributed and the plan applied." },
        );
      }}
    >
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="account email"
        aria-label="The account that made this payment"
        className="h-9 w-[220px] text-[12.5px]"
      />

      <Button type="submit" size="sm" disabled={pending || !email}>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Attribute
      </Button>

      <IgnoreButton paymentId={paymentId} />
    </form>
  );
}

/** Parks a payment that buys nothing — a test rupee, a tip, a duplicate. */
export function IgnoreButton({ paymentId }: { paymentId: string }) {
  const { pending, run } = useAdminAction();
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Button
      type="button"
      size="sm"
      variant={armed ? "destructive" : "ghost"}
      disabled={pending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        void run(ignorePayment, { paymentId }, { success: "Marked as buying nothing." });
      }}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {armed ? "Confirm — buys nothing" : "Buys nothing"}
    </Button>
  );
}
