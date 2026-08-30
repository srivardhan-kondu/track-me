"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateRole } from "@/app/actions/coach";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "ATHLETE",
    label: "Athlete",
    blurb: "Log meals, workouts and weight.",
  },
  {
    value: "COACH",
    label: "Coach",
    blurb: "Monitor athletes and leave feedback.",
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
    const res = await updateRole(fd);
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
    <div className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => choose(opt.value)}
          disabled={pending !== null}
          className={cn(
            "rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
            role === opt.value
              ? "border-primary bg-primary/10"
              : "border-border hover:bg-accent",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{opt.label}</span>
            {pending === opt.value && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {role === opt.value && pending === null && (
              <span className="text-xs font-medium text-primary">Active</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{opt.blurb}</p>
        </button>
      ))}
    </div>
  );
}
