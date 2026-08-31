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
  groups: string[];
};

type SearchResponse = { results: PickedExercise[] };

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

  // Debounce so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["exercise-search", debounced],
    queryFn: async () => {
      const res = await fetch(
        `/api/exercises?q=${encodeURIComponent(debounced)}`,
      );
      if (!res.ok) throw new Error("Search failed");
      return (await res.json()) as SearchResponse;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const results = data?.results ?? [];

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
            Picking from the catalog credits your sets to the right muscles.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bench press, squat, lat pulldown…"
            className="pl-9"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="-mx-1 max-h-[46vh] overflow-y-auto px-1">
          {results.length === 0 && !isFetching && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {debounced
                ? "No match — you can still type the name by hand."
                : "Start typing to search."}
            </p>
          )}

          <ul className="space-y-1">
            {results.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => pick(ex)}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="block text-sm font-medium">{ex.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {EQUIPMENT_LABELS[
                        ex.equipment as keyof typeof EQUIPMENT_LABELS
                      ] ?? ex.equipment}
                    </Badge>
                    {ex.groups.map((g) => (
                      <Badge key={g} variant="outline" className="text-[10px]">
                        {g}
                      </Badge>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
