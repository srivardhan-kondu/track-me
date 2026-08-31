"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateProfile } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runAction } from "@/lib/run-action";
import {
  feetInches,
  fromFeetInches,
  type HeightUnit,
  type UnitPrefs,
  type VolumeUnit,
  type WeightUnit,
} from "@/lib/units";
import { cn } from "@/lib/utils";

type Gender = "FEMALE" | "MALE" | null;

const CHOICES: { value: Gender; label: string }[] = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: null, label: "Rather not say" },
];

/** A two-or-three way pick, sized for a settings row. */
function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cn(
                "rounded-full px-4 py-2 text-[12.5px] transition-colors",
                selected
                  ? "bg-accent font-semibold text-accent-ink"
                  : "border border-line font-medium text-fg-muted hover:border-accent-line hover:text-fg",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The details onboarding asked for, editable afterwards. */
export function ProfileForm({
  gender: initialGender,
  age: initialAge,
  heightCm: initialHeight,
  units: initialUnits,
}: {
  gender: Gender;
  age: number | null;
  /** Always centimetres, as stored; the form reads it in whichever unit. */
  heightCm: number | null;
  units: UnitPrefs;
}) {
  const router = useRouter();
  const [gender, setGender] = React.useState<Gender>(initialGender);
  const [units, setUnits] = React.useState<UnitPrefs>(initialUnits);
  const [pending, startTransition] = React.useTransition();

  const [cm, setCm] = React.useState(
    initialHeight !== null ? String(initialHeight) : "",
  );
  const initialParts = initialHeight !== null ? feetInches(initialHeight) : null;
  const [feet, setFeet] = React.useState(
    initialParts ? String(initialParts.feet) : "",
  );
  const [inches, setInches] = React.useState(
    initialParts ? String(initialParts.inches) : "",
  );

  /**
   * Switching the unit converts what is already in the field rather than
   * clearing it — the height has not changed, only the way it is being read.
   */
  function changeHeightUnit(next: HeightUnit) {
    if (next === units.height) return;
    if (next === "FT") {
      const parts = cm.trim() ? feetInches(Number(cm)) : null;
      setFeet(parts ? String(parts.feet) : "");
      setInches(parts ? String(parts.inches) : "");
    } else {
      const filled = feet.trim() || inches.trim();
      setCm(
        filled
          ? String(fromFeetInches(Number(feet || 0), Number(inches || 0)))
          : "",
      );
    }
    setUnits((u) => ({ ...u, height: next }));
  }

  function submit(formData: FormData) {
    formData.set("gender", gender ?? "");
    formData.set("weightUnit", units.weight);
    formData.set("heightUnit", units.height);
    formData.set("volumeUnit", units.volume);

    startTransition(async () => {
      const res = await runAction(() => updateProfile(formData));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
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

        {units.height === "CM" ? (
          <div>
            <Label htmlFor="heightCm" className="mb-2 block">
              Height (cm)
            </Label>
            <Input
              id="heightCm"
              name="heightCm"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={90}
              max={250}
              value={cm}
              onChange={(e) => setCm(e.target.value)}
              placeholder="—"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="heightFeet" className="mb-2 block">
              Height (ft, in)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="heightFeet"
                name="heightFeet"
                type="number"
                inputMode="numeric"
                min={3}
                max={8}
                value={feet}
                onChange={(e) => setFeet(e.target.value)}
                placeholder="ft"
              />
              <Input
                id="heightInches"
                name="heightInches"
                type="number"
                inputMode="numeric"
                min={0}
                max={11}
                value={inches}
                onChange={(e) => setInches(e.target.value)}
                placeholder="in"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-[16px] border border-line p-4">
        <div>
          <p className="text-[12.5px] font-semibold text-fg">Units</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fg-dim">
            How your numbers are read back to you. Nothing you have logged
            changes — the same history is simply shown in the unit you pick,
            and your coach sees it in yours.
          </p>
        </div>

        <Pills<WeightUnit>
          label="Weight"
          value={units.weight}
          onChange={(v) => setUnits((u) => ({ ...u, weight: v }))}
          options={[
            { value: "KG", label: "Kilograms" },
            { value: "LB", label: "Pounds" },
          ]}
        />

        <Pills<HeightUnit>
          label="Height"
          value={units.height}
          onChange={changeHeightUnit}
          options={[
            { value: "CM", label: "Centimetres" },
            { value: "FT", label: "Feet & inches" },
          ]}
        />

        <Pills<VolumeUnit>
          label="Water"
          value={units.volume}
          onChange={(v) => setUnits((u) => ({ ...u, volume: v }))}
          options={[
            { value: "ML", label: "Millilitres" },
            { value: "FL_OZ", label: "Fluid ounces" },
          ]}
        />
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
