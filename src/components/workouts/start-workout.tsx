"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { startSession } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/run-action";

/**
 * Opens a session and goes to it.
 *
 * The draft is created here rather than by the session page itself, because a
 * page that writes a row every time it is rendered leaves an empty workout
 * behind for every stray visit and every prefetch.
 */
export function StartWorkout({
  label = "Start workout",
  resuming = false,
  className,
  variant,
  size = "default",
}: {
  label?: string;
  /** Changes only the wording of a failure — there is one action either way. */
  resuming?: boolean;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function open() {
    if (pending) return;
    setPending(true);

    const res = await runAction(async () => {
      const started = await startSession();
      return started.ok ? { ok: true as const } : started;
    });

    if (!res.ok) {
      setPending(false);
      return void toast.error(res.error);
    }

    router.push("/session");
  }

  return (
    <Button
      onClick={open}
      disabled={pending}
      className={className}
      variant={variant}
      size={size}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      {resuming ? "Resume workout" : label}
    </Button>
  );
}
