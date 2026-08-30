"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteWeightEntry } from "@/app/actions/weight";
import { deleteWorkout, reprocessWorkout } from "@/app/actions/workouts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkoutActions({ workoutId }: { workoutId: string }) {
  const router = useRouter();

  async function reprocess() {
    const res = await reprocessWorkout(workoutId);
    if (!res.ok) return toast.error(res.error);
    toast.success("Re-parsing your sets…");
    router.refresh();
  }

  async function remove() {
    const res = await deleteWorkout(workoutId);
    if (!res.ok) return toast.error(res.error);
    toast.success("Workout deleted.");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="Workout options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={reprocess}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Re-parse
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={remove}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WeightActions({ entryId }: { entryId: string }) {
  const router = useRouter();

  async function remove() {
    const res = await deleteWeightEntry(entryId);
    if (!res.ok) return toast.error(res.error);
    toast.success("Check-in deleted.");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="Check-in options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={remove}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
