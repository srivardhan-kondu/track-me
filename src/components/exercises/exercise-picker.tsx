"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EQUIPMENT_LABELS } from "@/../prisma/data/taxonomy";

export type PickedExercise = {
  id: string;
  name: string;
  equipment: string;
};

type CatalogGroup = {
  groupId: string;
  name: string;
  exercises: (PickedExercise & { type: string; pattern: string })[];
};

type BrowseResponse = { groups: CatalogGroup[] };

function equipmentLabel(value: string): string {
  return (
    EQUIPMENT_LABELS[value as keyof typeof EQUIPMENT_LABELS] ??
    value.replace(/_/g, " ").toLowerCase()
  );
}

/**
 * Browse the catalog by muscle group rather than as one long list of names.
 * Athletes pick an exercise by what they are training, so the groups run A-Z
 * with their exercises beneath — and a movement appears under every group it
 * trains directly.
 */
export function ExercisePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (exercise: PickedExercise) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["exercise-browse", debounced],
    queryFn: async () => {
      const res = await fetch(
        `/api/exercises?q=${encodeURIComponent(debounced)}`,
      );
      if (!res.ok) throw new Error("Search failed");
      return (await res.json()) as BrowseResponse;
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const groups = data?.groups ?? [];
  const total = groups.reduce((a, g) => a + g.exercises.length, 0);

  function pick(exercise: PickedExercise) {
    onPick(exercise);
    onOpenChange(false);
    setQuery("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose an exercise</DialogTitle>
          <DialogDescription>
            Grouped by what each movement trains. Picking from the catalog
            credits your sets to the right muscles.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, or browse the groups below"
            className="pl-9"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg-faint" />
          )}
        </div>

        <div className="-mx-1 max-h-[52vh] overflow-y-auto px-1">
          {groups.length === 0 && !isFetching && (
            <p className="py-6 text-center text-[12.5px] text-fg-dim">
              No match — you can still type the name by hand.
            </p>
          )}

          {groups.map((group) => (
            <section key={group.groupId}>
              <h3 className="sticky top-0 z-10 flex items-baseline gap-2 bg-bg/95 py-2 backdrop-blur">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] bg-accent-soft text-[10px] font-semibold text-accent-text">
                  {group.name.charAt(0)}
                </span>
                <span className="text-[12.5px] font-semibold text-fg">{group.name}</span>
                <span className="tabular font-mono text-[11px] text-fg-faint">
                  {group.exercises.length}
                </span>
              </h3>

              <ul className="mb-2 space-y-0.5">
                {group.exercises.map((ex) => (
                  <li key={`${group.groupId}-${ex.id}`}>
                    <button
                      type="button"
                      onClick={() => pick(ex)}
                      className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-muted">
                        {ex.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px] font-normal"
                      >
                        {equipmentLabel(ex.equipment)}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {total > 0 && (
          <p className="mono-label">
            {total} exercise{total === 1 ? "" : "s"} across {groups.length}{" "}
            group{groups.length === 1 ? "" : "s"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
