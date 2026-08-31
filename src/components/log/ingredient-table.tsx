"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { totalsOf, type MealItem } from "@/lib/meal-items";
import { cn } from "@/lib/utils";

/** A blank line, for "Add ingredient". */
export function emptyItem(): MealItem {
  return {
    name: "",
    quantity: "",
    grams: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
}

/**
 * A number cell.
 *
 * Held as a string while it is being typed: binding a number input straight to
 * a number means clearing the field to retype it snaps it back to 0, and the
 * cursor jumps. The string is only converted on the way out.
 */
function NumberCell({
  value,
  onChange,
  label,
  width = "w-[52px]",
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  width?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (value === 0 ? "" : String(value));

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={shown}
      placeholder="0"
      onChange={(e) => {
        const next = e.target.value;
        if (!/^\d*\.?\d*$/.test(next)) return;
        setDraft(next);
        onChange(next === "" || next === "." ? 0 : Number(next));
      }}
      onBlur={() => setDraft(null)}
      className={cn(
        "tabular h-9 rounded-[10px] border border-line bg-surface-inset px-2 text-right text-[12.5px] text-fg",
        "focus-visible:border-accent focus-visible:outline-none",
        width,
      )}
    />
  );
}

/**
 * The meal's ingredients, as an editable table.
 *
 * What the model heard is the starting point, not the answer — every line can
 * be renamed, re-weighed or removed, and the totals underneath are recomputed
 * from the rows as they change rather than being typed separately.
 */
export function IngredientTable({
  items,
  onChange,
  disabled,
}: {
  items: MealItem[];
  onChange: (next: MealItem[]) => void;
  disabled?: boolean;
}) {
  const totals = totalsOf(items);

  function patch(index: number, field: keyof MealItem, value: string | number) {
    onChange(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/*
        Scrolls inside itself on a narrow screen. The columns are numeric and
        cannot usefully wrap, so the alternative is a page that scrolls
        sideways.
      */}
      {/*
        min-w-0 is what lets this shrink inside the dialog: a flex item's
        automatic minimum is its content width, so without it the table's
        min-width pushes the whole panel wider than the screen instead of
        scrolling within it.
      */}
      <div className="-mx-1 min-w-0 overflow-x-auto px-1">
        <table className="w-full min-w-[460px] border-separate border-spacing-y-1.5">
          <thead>
            <tr>
              <th className="mono-label pb-1 text-left">Ingredient</th>
              <th className="mono-label pb-1 text-right">Grams</th>
              <th className="mono-label pb-1 text-right">kcal</th>
              <th className="mono-label pb-1 text-right">P</th>
              <th className="mono-label pb-1 text-right">C</th>
              <th className="mono-label pb-1 text-right">F</th>
              <th className="w-8" />
            </tr>
          </thead>

          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="pr-2">
                  <input
                    type="text"
                    aria-label={`Ingredient ${i + 1} name`}
                    value={item.name}
                    placeholder="Ingredient"
                    onChange={(e) => patch(i, "name", e.target.value)}
                    disabled={disabled}
                    className="h-9 w-full min-w-[104px] rounded-[10px] border border-line bg-surface-inset px-2.5 text-[12.5px] text-fg placeholder:text-fg-faint focus-visible:border-accent focus-visible:outline-none"
                  />
                </td>
                <td className="px-1 text-right">
                  <NumberCell
                    label={`Ingredient ${i + 1} grams`}
                    value={item.grams}
                    onChange={(n) => patch(i, "grams", n)}
                  />
                </td>
                <td className="px-1 text-right">
                  <NumberCell
                    label={`Ingredient ${i + 1} calories`}
                    value={item.calories}
                    onChange={(n) => patch(i, "calories", n)}
                  />
                </td>
                <td className="px-1 text-right">
                  <NumberCell
                    label={`Ingredient ${i + 1} protein`}
                    value={item.protein}
                    onChange={(n) => patch(i, "protein", n)}
                    width="w-[44px]"
                  />
                </td>
                <td className="px-1 text-right">
                  <NumberCell
                    label={`Ingredient ${i + 1} carbs`}
                    value={item.carbs}
                    onChange={(n) => patch(i, "carbs", n)}
                    width="w-[44px]"
                  />
                </td>
                <td className="px-1 text-right">
                  <NumberCell
                    label={`Ingredient ${i + 1} fat`}
                    value={item.fat}
                    onChange={(n) => patch(i, "fat", n)}
                    width="w-[44px]"
                  />
                </td>
                <td className="pl-1">
                  <button
                    type="button"
                    aria-label={`Remove ${item.name || `ingredient ${i + 1}`}`}
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                    disabled={disabled}
                    className="grid h-8 w-8 place-items-center rounded-full text-fg-faint transition-colors hover:bg-hover hover:text-clay-text"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[12.5px] text-fg-dim">
                  Nothing was picked out. Add what you ate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => onChange([...items, emptyItem()])}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12px] font-medium text-fg-muted transition-colors hover:border-accent-line hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" />
          Add ingredient
        </button>

        <dl className="tabular flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px]">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-dim">Total</dt>
            <dd className="font-semibold text-fg">{totals.calories} kcal</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-dim">P</dt>
            <dd className="text-fg-muted">{totals.protein}g</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-dim">C</dt>
            <dd className="text-fg-muted">{totals.carbs}g</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-dim">F</dt>
            <dd className="text-fg-muted">{totals.fat}g</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
