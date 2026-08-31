"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { runAction, type ActionResult } from "@/lib/run-action";

export type AdminAction = (formData: FormData) => Promise<ActionResult>;

/**
 * Calls one admin action and reports what happened.
 *
 * Every button in the console goes through this, so they all behave the same
 * way: disabled while in flight, a toast either way, and a refresh afterwards
 * so the figure the admin is looking at is the figure in the database rather
 * than the one that was there when the page rendered.
 */
export function useAdminAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(
    async (
      action: AdminAction,
      fields: Record<string, string | number | boolean | undefined>,
      options: { success?: string; onDone?: (result: ActionResult) => void } = {},
    ) => {
      if (pending) return;
      setPending(true);

      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) formData.set(key, String(value));
      }

      const result = await runAction(() => action(formData));
      setPending(false);

      if (!result.ok) toast.error(result.error);
      else if (options.success) toast.success(options.success);

      options.onDone?.(result);
      if (result.ok) router.refresh();
      return result;
    },
    [pending, router],
  );

  return { pending, run };
}

/**
 * A button that runs an admin action.
 *
 * `confirm` turns it into a two-step: the first click arms it and the label
 * changes to say what is about to happen, the second commits. A native
 * confirm() dialog would be one keystroke away from being dismissed by
 * habit — this one has to be read, because the button it replaces is gone.
 */
export function ActionButton({
  action,
  fields = {},
  label,
  confirm,
  success,
  icon,
  variant = "outline",
  size = "sm",
  disabled,
  className,
}: {
  action: AdminAction;
  fields?: Record<string, string | number | boolean | undefined>;
  label: string;
  /** The armed label — what the second click will do. */
  confirm?: string;
  success?: string;
  icon?: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  className?: string;
}) {
  const { pending, run } = useAdminAction();
  const [armed, setArmed] = React.useState(false);

  // Disarm on its own, so a button left armed on a screen nobody is watching
  // does not become a single-click destructive action ten minutes later.
  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(timer);
  }, [armed]);

  const armedNow = Boolean(confirm) && armed;

  return (
    <Button
      type="button"
      variant={armedNow ? "destructive" : variant}
      size={size}
      disabled={disabled || pending}
      className={className}
      onClick={() => {
        if (confirm && !armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        void run(action, fields, { success });
      }}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        armedNow ? null : icon
      )}
      {armedNow ? confirm : label}
    </Button>
  );
}
