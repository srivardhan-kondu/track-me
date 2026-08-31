"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateRole } from "@/app/actions/coach";
import { ChoiceTile } from "@/components/ui/choice";
import { runAction } from "@/lib/run-action";

const OPTIONS = [
  {
    value: "ATHLETE",
    label: "Athlete",
    blurb: "Meals, workouts, weight.",
  },
  {
    value: "COACH",
    label: "Coach",
    blurb: "Monitor athletes, leave feedback.",
  },
] as const;

export function RoleSwitcher({ role }: { role: "ATHLETE" | "COACH" }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function choose(next: "ATHLETE" | "COACH") {
    if (next === role || pending) return;

    setPending(next);
    const fd = new FormData();
    fd.set("role", next);
    const res = await runAction(() => updateRole(fd));
    setPending(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(
      next === "COACH" ? "Coach mode enabled." : "Athlete mode enabled.",
    );
    // The role lives in the JWT, so re-read the session before navigating.
    router.refresh();
    if (next === "COACH") router.push("/trainer");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((opt) => (
        <ChoiceTile
          key={opt.value}
          title={opt.label}
          blurb={opt.blurb}
          selected={role === opt.value}
          disabled={pending !== null}
          onClick={() => choose(opt.value)}
          adornment={
            pending === opt.value ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-dim" />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
