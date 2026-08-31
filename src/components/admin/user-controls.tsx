"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";

import { useAdminAction } from "@/components/admin/action-button";
import {
  deleteUser,
  extendTrial,
  setAdmin,
  setPlan,
  setRole,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A row of mutually exclusive choices, one of which is already true. */
function Segmented({
  options,
  current,
  disabled,
  onPick,
}: {
  options: { value: string; label: string }[];
  current: string | null;
  disabled?: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled || selected}
            onClick={() => onPick(option.value)}
            aria-pressed={selected}
            className={cn(
              "rounded-full px-4 py-2 text-[12px] font-medium transition-colors",
              selected
                ? "bg-accent font-semibold text-accent-ink"
                : "border border-line text-fg-muted hover:border-accent-line hover:text-fg",
              disabled && !selected && "opacity-50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Comps or withdraws Premium.
 *
 * The reason is optional but asked for every time, because the audit line is
 * the only thing that will explain, six months from now, why this one account
 * has a lifetime plan and no payment against it.
 */
export function PlanControls({
  userId,
  term,
  paying,
}: {
  userId: string;
  term: string | null;
  paying: boolean;
}) {
  const { pending, run } = useAdminAction();
  const [reason, setReason] = React.useState("");

  return (
    <div className="flex flex-col gap-3.5">
      <Segmented
        current={paying ? term : "FREE"}
        disabled={pending}
        options={[
          { value: "MONTHLY", label: "Monthly" },
          { value: "YEARLY", label: "Yearly" },
          { value: "LIFETIME", label: "Lifetime" },
          { value: "FREE", label: "No plan" },
        ]}
        onPick={(value) =>
          run(
            setPlan,
            { userId, term: value, reason },
            {
              success:
                value === "FREE" ? "Premium revoked." : `${value} plan granted.`,
              onDone: (result) => {
                if (result.ok) setReason("");
              },
            },
          )
        }
      />

      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why (goes in the audit log)"
        aria-label="Reason for the plan change"
        maxLength={280}
      />

      <p className="text-[11.5px] leading-relaxed text-fg-dim">
        Granting here records no payment — comped access never shows up as
        revenue. A lifetime plan is never overwritten by a shorter one.
      </p>
    </div>
  );
}

/** Adds days to a trial, from today or from its existing end — whichever is later. */
export function TrialControls({ userId }: { userId: string }) {
  const { pending, run } = useAdminAction();
  const [days, setDays] = React.useState("14");

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex gap-2">
        {["7", "14", "30"].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setDays(preset)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[11.5px] font-medium transition-colors",
              days === preset
                ? "border-accent-line bg-accent-soft text-accent-text"
                : "border-line text-fg-muted hover:text-fg",
            )}
          >
            {preset}d
          </button>
        ))}
      </div>

      <Input
        type="number"
        min={1}
        max={365}
        value={days}
        onChange={(event) => setDays(event.target.value)}
        aria-label="Days to add to the trial"
        className="w-[92px]"
      />

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(extendTrial, { userId, days }, { success: `Trial extended by ${days} days.` })
        }
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Extend trial
      </Button>
    </div>
  );
}

export function RoleControls({
  userId,
  role,
}: {
  userId: string;
  role: "ATHLETE" | "COACH";
}) {
  const { pending, run } = useAdminAction();

  return (
    <Segmented
      current={role}
      disabled={pending}
      options={[
        { value: "ATHLETE", label: "Athlete" },
        { value: "COACH", label: "Coach" },
      ]}
      onPick={(value) =>
        run(setRole, { userId, role: value }, { success: "Role changed." })
      }
    />
  );
}

/**
 * Grants or revokes console access.
 *
 * The button for revoking your own is not rendered at all — the action refuses
 * it too, but a control that exists only to be refused is a control that
 * should not be there.
 */
export function AdminToggle({
  userId,
  isAdmin,
  isSelf,
  byEmail,
}: {
  userId: string;
  isAdmin: boolean;
  isSelf: boolean;
  /** Admin by the ADMIN_EMAILS allowlist, which no button can take away. */
  byEmail: boolean;
}) {
  const { pending, run } = useAdminAction();

  if (byEmail) {
    return (
      <p className="text-[12px] leading-relaxed text-fg-dim">
        This address is on the <code className="text-fg-muted">ADMIN_EMAILS</code>{" "}
        allowlist, so it is an admin whatever this page does. Remove it from the
        environment to change that.
      </p>
    );
  }

  if (isSelf && isAdmin) {
    return (
      <p className="text-[12px] leading-relaxed text-fg-dim">
        This is you. Another admin has to be the one to remove your access —
        one mis-click here would otherwise cost a redeploy.
      </p>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={isAdmin ? "destructive" : "outline"}
      disabled={pending}
      onClick={() =>
        run(
          setAdmin,
          { userId, grant: isAdmin ? "false" : "true" },
          { success: isAdmin ? "Admin access revoked." : "Admin access granted." },
        )
      }
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isAdmin ? (
        <ShieldOff className="h-3.5 w-3.5" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" />
      )}
      {isAdmin ? "Revoke admin" : "Make admin"}
    </Button>
  );
}

/**
 * Deletes an account, and everything cascading off it.
 *
 * The email has to be typed back. There is no undo and no soft-delete: meals,
 * workouts, weigh-ins, photos and comments all go, and the only thing left
 * behind is the audit line and any payments, which are detached rather than
 * deleted.
 */
export function DeleteAccount({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");

  // An account with no email on file is confirmed by its id, so an abandoned
  // sign-up is still removable.
  const expected = email ?? userId;
  const matches = confirm.trim().toLowerCase() === expected.toLowerCase();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this account</DialogTitle>
            <DialogDescription>
              Every meal, workout, weigh-in, photo and comment goes with it, and
              none of it can be brought back. Payments stay on the books,
              detached from the account that made them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2.5">
            <label className="mono-label" htmlFor="confirm-email">
              Type {expected} to confirm
            </label>
            <Input
              id="confirm-email"
              value={confirm}
              autoComplete="off"
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={expected}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!matches || pending}
              onClick={() =>
                run(
                  deleteUser,
                  { userId, confirm },
                  {
                    success: "Account deleted.",
                    onDone: (result) => {
                      if (!result.ok) return;
                      setOpen(false);
                      router.push("/admin/users");
                    },
                  },
                )
              }
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete for good
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
