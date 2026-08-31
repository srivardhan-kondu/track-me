"use client";

import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";

import { unlinkAthlete } from "@/app/actions/coach";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/run-action";

export function RemoveAthlete({ athleteId }: { athleteId: string }) {
  const router = useRouter();

  async function remove() {
    const res = await runAction(() => unlinkAthlete(athleteId));
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Athlete removed from your roster.");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={remove}
      aria-label="Remove athlete"
      className="text-fg-faint hover:text-clay-text"
    >
      <UserMinus className="h-4 w-4" />
    </Button>
  );
}
