"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateProfile } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Gender = "FEMALE" | "MALE" | null;

const CHOICES: { value: Gender; label: string }[] = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: null, label: "Rather not say" },
];

/** The details onboarding asked for, editable afterwards. */
export function ProfileForm({
  gender: initialGender,
  age: initialAge,
  heightCm: initialHeight,
}: {
  gender: Gender;
  age: number | null;
  heightCm: number | null;
}) {
  const router = useRouter();
  const [gender, setGender] = React.useState<Gender>(initialGender);
  const [pending, startTransition] = React.useTransition();

  function submit(formData: FormData) {
    formData.set("gender", gender ?? "");
    startTransition(async () => {
      const res = await updateProfile(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block">You are</Label>
        <div className="flex flex-wrap gap-2">
          {CHOICES.map((choice) => {
            const selected = gender === choice.value;
            return (
              <button
                key={choice.label}
                type="button"
                onClick={() => setGender(choice.value)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full px-4 py-2 text-[12.5px] transition-colors",
                  selected
                    ? "bg-accent font-semibold text-accent-ink"
                    : "border border-line font-medium text-fg-muted hover:border-accent-line hover:text-fg",
                )}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-fg-dim">
          This only picks which portrait the dashboard shows.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="age" className="mb-2 block">
            Age
          </Label>
          <Input
            id="age"
            name="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={100}
            defaultValue={initialAge ?? ""}
            placeholder="—"
          />
        </div>
        <div>
          <Label htmlFor="heightCm" className="mb-2 block">
            Height (cm)
          </Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="numeric"
            min={90}
            max={250}
            defaultValue={initialHeight ?? ""}
            placeholder="—"
          />
        </div>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
