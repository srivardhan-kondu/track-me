"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { completeOnboarding, skipOnboarding } from "@/app/actions/onboarding";
import {
  cmToInches,
  displayWeight,
  feetInches,
  formatHeight,
  formatWeight,
  inchesToCm,
  toKg,
  type HeightUnit,
  type WeightUnit,
} from "@/lib/units";
import { cn } from "@/lib/utils";

type Gender = "FEMALE" | "MALE";

const STEPS = ["gender", "age", "height", "weight", "review"] as const;
type Step = (typeof STEPS)[number];

/* -------------------------------------------------------------------------
   Pieces shared by every step
   ------------------------------------------------------------------------- */

/**
 * The measured slider from the reference: a hairline track with the travelled
 * part in violet, evenly spaced ticks, and a violet thumb ringed in white.
 *
 * It is a real `input[type=range]` underneath — laid over the drawing at zero
 * opacity — so keyboard, screen readers and touch all behave natively rather
 * than being re-implemented with pointer handlers.
 */
function Slider({
  value,
  min,
  max,
  step = 1,
  ticks,
  onChange,
  label,
  formatTick,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  ticks: number[];
  onChange: (n: number) => void;
  label: string;
  /** How a tick reads — inches want "5′ 0″", not "60". */
  formatTick?: (n: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full">
      <div className="relative h-6">
        {/* Track — one uniform hairline; the reference does not fill it. */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />

        {/* Ticks */}
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-1/2 h-[7px] w-px -translate-y-1/2 bg-line-strong"
            style={{ left: `${((t - min) / (max - min)) * 100}%` }}
          />
        ))}

        {/* Thumb — a violet ring around a white core, lit from behind. */}
        <span
          className="pointer-events-none absolute top-1/2 grid h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent"
          style={{
            left: `${pct}%`,
            boxShadow:
              "0 0 0 3px rgba(152,120,230,0.25), 0 0 14px 2px rgba(152,120,230,0.45)",
          }}
        >
          <span className="h-[12px] w-[12px] rounded-full bg-white" />
        </span>

        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      <div className="relative mt-3 h-4">
        {ticks.map((t) => (
          <span
            key={t}
            className="tabular absolute -translate-x-1/2 text-[11px] text-fg-dim"
            style={{ left: `${((t - min) / (max - min)) * 100}%` }}
          >
            {formatTick ? formatTick(t) : t}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The unit this step is being answered in.
 *
 * Offered on the step itself rather than buried in Settings afterwards: an
 * athlete who thinks in pounds should never have to enter a number in
 * kilograms first and correct it later.
 */
function UnitSwitch<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mt-6 flex justify-center">
      <div className="flex gap-1 rounded-full border border-line p-1">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
                selected
                  ? "bg-accent font-semibold text-accent-ink"
                  : "font-medium text-fg-muted hover:text-fg",
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

/** The huge figure each measurement step is built around. */
function BigValue({ value, unit }: { value: React.ReactNode; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="tabular font-serif text-[64px] leading-none text-fg">
        {value}
      </span>
      <span className="mt-2 text-[14px] text-fg-muted">{unit}</span>
    </div>
  );
}

/** One of the two portrait cards on the opening step. */
function GenderCard({
  gender,
  label,
  src,
  selected,
  onSelect,
}: {
  gender: Gender;
  label: string;
  src: string | null;
  selected: boolean;
  onSelect: (g: Gender) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(gender)}
      aria-pressed={selected}
      className={cn(
        "relative aspect-[3/5.1] overflow-hidden rounded-[18px] border transition-colors",
        selected ? "border-accent" : "border-line hover:border-line-strong",
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 640px) 200px, 45vw"
          className="object-cover object-top"
        />
      ) : (
        <span className="accent-gradient absolute inset-0" />
      )}

      {/* The name sits on the photo, so it needs its own ground. */}
      <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg via-bg/70 to-transparent" />

      {selected && (
        <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-accent">
          <Check className="h-3.5 w-3.5 text-accent-ink" strokeWidth={3} />
        </span>
      )}

      <span className="absolute inset-x-0 bottom-3.5 text-center text-[15px] font-semibold text-fg">
        {label}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------
   The flow
   ------------------------------------------------------------------------- */

export function OnboardingFlow({
  name,
  portraits,
}: {
  name: string;
  /** Which athlete portraits are actually on disk, decided on the server. */
  portraits: { FEMALE: string | null; MALE: string | null };
}) {
  const router = useRouter();

  const [index, setIndex] = React.useState(0);
  const [gender, setGender] = React.useState<Gender | null>(null);
  const [age, setAge] = React.useState(28);
  // Held in the units the columns use, whatever is on screen. The sliders
  // convert at the edge, so switching kg to lb re-reads the same figure rather
  // than resetting it.
  const [heightCm, setHeightCm] = React.useState(165);
  const [weightKg, setWeightKg] = React.useState(68);
  const [heightUnit, setHeightUnit] = React.useState<HeightUnit>("CM");
  const [weightUnit, setWeightUnit] = React.useState<WeightUnit>("KG");
  const [pending, startTransition] = React.useTransition();

  const step: Step = STEPS[index];

  function finish() {
    startTransition(async () => {
      const res = await completeOnboarding({
        gender,
        age,
        heightCm,
        weightKg,
        heightUnit,
        weightUnit,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  function skip() {
    startTransition(async () => {
      await skipOnboarding();
      router.replace("/dashboard");
      router.refresh();
    });
  }

  function next() {
    if (index === STEPS.length - 1) finish();
    else setIndex((i) => i + 1);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <p className="mono-label pt-3 text-fg-muted">
        Onboarding {index + 1}/{STEPS.length}
      </p>

      <div className="flex h-12 items-center justify-between">
        <button
          type="button"
          onClick={() => (index === 0 ? skip() : setIndex((i) => i - 1))}
          aria-label={index === 0 ? "Skip onboarding" : "Back"}
          className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-fg transition-colors hover:bg-hover"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={skip}
          disabled={pending}
          className="text-[14px] font-medium text-fg transition-colors hover:text-fg-muted disabled:opacity-50"
        >
          Skip
        </button>
      </div>

      {step === "gender" && (
        <StepBody
          title="Who are you?"
          blurb="This helps us personalize your experience."
        >
          <div className="grid grid-cols-2 gap-3.5">
            <GenderCard
              gender="FEMALE"
              label="Female"
              src={portraits.FEMALE}
              selected={gender === "FEMALE"}
              onSelect={setGender}
            />
            <GenderCard
              gender="MALE"
              label="Male"
              src={portraits.MALE}
              selected={gender === "MALE"}
              onSelect={setGender}
            />
          </div>
        </StepBody>
      )}

      {step === "age" && (
        <StepBody
          title="What's your age?"
          blurb="Your age helps us customize your fitness plan."
        >
          <BigValue value={age} unit="Years" />
          <div className="mt-10 px-1">
            <Slider
              label="Age in years"
              value={age}
              min={18}
              max={40}
              ticks={[18, 25, 30, 35, 40]}
              onChange={setAge}
            />
          </div>
        </StepBody>
      )}

      {step === "height" && (
        <StepBody
          title="What's your height?"
          blurb="This helps us calculate your performance better."
        >
          {heightUnit === "CM" ? (
            <>
              <BigValue value={heightCm} unit="cm" />
              <div className="mt-10 px-1">
                <Slider
                  label="Height in centimetres"
                  value={heightCm}
                  min={140}
                  max={190}
                  ticks={[140, 150, 160, 170, 180, 190]}
                  onChange={setHeightCm}
                />
              </div>
            </>
          ) : (
            <>
              <BigValue
                value={`${feetInches(heightCm).feet}′ ${feetInches(heightCm).inches}″`}
                unit="feet & inches"
              />
              <div className="mt-10 px-1">
                {/* The same 140–190 cm span, measured in whole inches. */}
                <Slider
                  label="Height in feet and inches"
                  value={Math.round(cmToInches(heightCm))}
                  min={55}
                  max={75}
                  ticks={[56, 60, 64, 68, 72]}
                  formatTick={(n) => `${Math.floor(n / 12)}′${n % 12}″`}
                  onChange={(inches) => setHeightCm(inchesToCm(inches))}
                />
              </div>
            </>
          )}

          <UnitSwitch<HeightUnit>
            value={heightUnit}
            onChange={setHeightUnit}
            options={[
              { value: "CM", label: "cm" },
              { value: "FT", label: "ft & in" },
            ]}
          />
        </StepBody>
      )}

      {step === "weight" && (
        <StepBody
          title="What's your weight?"
          blurb="This helps us track your progress accurately."
        >
          <BigValue
            value={displayWeight(weightKg, weightUnit)}
            unit={weightUnit === "LB" ? "lb" : "kg"}
          />
          <div className="mt-10 px-1">
            {weightUnit === "KG" ? (
              // Half-kilo steps: a bathroom scale reads 68.5, and rounding it
              // to 68 on the way in loses a real number.
              <Slider
                label="Weight in kilograms"
                value={weightKg}
                min={40}
                max={100}
                step={0.5}
                ticks={[40, 50, 60, 70, 80, 90, 100]}
                onChange={setWeightKg}
              />
            ) : (
              <Slider
                label="Weight in pounds"
                value={Math.round(displayWeight(weightKg, "LB"))}
                min={88}
                max={220}
                ticks={[88, 110, 132, 154, 176, 198, 220]}
                onChange={(lb) => setWeightKg(toKg(lb, "LB"))}
              />
            )}
          </div>

          <UnitSwitch<WeightUnit>
            value={weightUnit}
            onChange={setWeightUnit}
            options={[
              { value: "KG", label: "kg" },
              { value: "LB", label: "lb" },
            ]}
          />
        </StepBody>
      )}

      {step === "review" && (
        <StepBody
          title={`You're all set, ${name}.`}
          blurb="You can change any of this later in Settings."
        >
          <dl className="overflow-hidden rounded-[18px] border border-line">
            <Row
              label="You are"
              value={
                gender === "FEMALE"
                  ? "Female"
                  : gender === "MALE"
                    ? "Male"
                    : "Not said"
              }
            />
            <Row label="Age" value={`${age} years`} />
            <Row label="Height" value={formatHeight(heightCm, heightUnit)} />
            <Row label="Weight" value={formatWeight(weightKg, weightUnit)} />
          </dl>
        </StepBody>
      )}

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={next}
          disabled={pending}
          className="accent-glow flex h-[52px] w-full items-center justify-center rounded-[16px] bg-accent px-6 text-[15px] font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          <span className="flex-1 text-center">
            {step === "review" ? "Start training" : "Next"}
          </span>
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
        </button>

        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-accent" : "w-1.5 bg-line-strong",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepBody({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-6">
      <h1 className="font-serif text-[28px] leading-tight text-fg">{title}</h1>
      <p className="mt-3 max-w-[19rem] text-[13.5px] leading-relaxed text-fg-muted">
        {blurb}
      </p>
      <div className="pt-9">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3.5 last:border-b-0">
      <dt className="text-[13px] text-fg-muted">{label}</dt>
      <dd className="text-[13.5px] font-semibold text-fg">{value}</dd>
    </div>
  );
}
