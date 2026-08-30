"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteMeal, reprocessMeal, updateMealMacros } from "@/app/actions/meals";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MealActions({
  meal,
}: {
  meal: {
    id: string;
    title: string | null;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [form, setForm] = React.useState({
    title: meal.title ?? "",
    calories: meal.calories?.toString() ?? "",
    protein: meal.protein?.toString() ?? "",
    carbs: meal.carbs?.toString() ?? "",
    fat: meal.fat?.toString() ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);

    const fd = new FormData();
    fd.set("mealId", meal.id);
    fd.set("title", form.title);
    fd.set("calories", form.calories || "0");
    fd.set("protein", form.protein || "0");
    fd.set("carbs", form.carbs || "0");
    fd.set("fat", form.fat || "0");

    const res = await updateMealMacros(fd);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Meal updated.");
    setEditing(false);
    router.refresh();
  }

  async function handleReprocess() {
    const res = await reprocessMeal(meal.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Re-estimating…");
    router.refresh();
  }

  async function handleDelete() {
    const res = await deleteMeal(meal.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Meal deleted.");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            aria-label="Meal options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Correct macros
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReprocess}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-run estimate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Correct the estimate</DialogTitle>
            <DialogDescription>
              Your numbers replace the AI&apos;s and are what your coach sees.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Meal</Label>
              <Input
                id="edit-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Chicken and rice"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["calories", "Calories (kcal)"],
                  ["protein", "Protein (g)"],
                  ["carbs", "Carbs (g)"],
                  ["fat", "Fat (g)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`edit-${key}`}>{label}</Label>
                  <Input
                    id={`edit-${key}`}
                    type="number"
                    min={0}
                    step="0.1"
                    inputMode="decimal"
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
