"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteMeal, reprocessMeal, updateMealItems } from "@/app/actions/meals";
import { IngredientTable } from "@/components/log/ingredient-table";
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
import { seedMealItems, type MealItem } from "@/lib/meal-items";
import { runAction } from "@/lib/run-action";

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
    items?: unknown;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [title, setTitle] = React.useState(meal.title ?? "");
  const [items, setItems] = React.useState<MealItem[]>([]);

  /*
    Seeded when the dialog opens rather than at mount, so reopening it after a
    re-run shows what the new estimate produced instead of the stale rows.
    A meal analysed before ingredients were stored has none; it starts with one
    blank line so there is something to type into.
  */
  function beginEditing() {
    setTitle(meal.title ?? "");
    setItems(seedMealItems(meal));
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);

    const cleaned = items.filter((item) => item.name.trim().length > 0);
    const res = await runAction(() =>
      updateMealItems({
        mealId: meal.id,
        title: title.trim() || undefined,
        items: cleaned,
      }),
    );
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
    const res = await runAction(() => reprocessMeal(meal.id));
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Re-estimating…");
    router.refresh();
  }

  async function handleDelete() {
    const res = await runAction(() => deleteMeal(meal.id));
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
            size="icon-sm"
            className="h-7 w-7 shrink-0 text-fg-faint"
            aria-label="Meal options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={beginEditing}>
            <Pencil className="mr-2 h-4 w-4" />
            Correct ingredients
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleReprocess}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-run estimate
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-clay-text focus:text-clay-text"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Correct the estimate</DialogTitle>
            <DialogDescription>
              Your numbers replace the AI&apos;s and are what your coach sees.
              The totals follow the rows.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">Meal</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Chicken and rice"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label>Ingredients</Label>
              <IngredientTable
                items={items}
                onChange={setItems}
                disabled={pending}
              />
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
