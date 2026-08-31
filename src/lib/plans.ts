import {
  Camera,
  Download,
  History,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { FREE_HISTORY_DAYS, PRICES, type PlanTerm } from "@/lib/entitlements";

/**
 * How the plans are *described*. The prices themselves live in entitlements —
 * this file only formats them, so a price change is still a one-line change in
 * one place, and the settings sheet can never quote a figure the server would
 * refuse to charge.
 */

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** What a year of monthly billing costs over the yearly plan. */
export const YEARLY_SAVING = PRICES.MONTHLY * 12 - PRICES.YEARLY;

export type PlanCard = {
  term: PlanTerm;
  name: string;
  price: string;
  cadence: string;
  /** Sits on the card's shoulder — the reason to pick this one. */
  ribbon?: string;
  blurb: string;
  /** The one card the eye should land on first. */
  featured?: boolean;
};

export const PLAN_CARDS: PlanCard[] = [
  {
    term: "MONTHLY",
    name: "Monthly",
    price: rupees(PRICES.MONTHLY),
    cadence: "per month",
    blurb: "Everything below. Cancel by simply not renewing.",
  },
  {
    term: "YEARLY",
    name: "Yearly",
    price: rupees(PRICES.YEARLY),
    cadence: "per year",
    ribbon: `Save ${rupees(YEARLY_SAVING)}`,
    blurb: `About ${rupees(Math.round(PRICES.YEARLY / 12))} a month — two months free.`,
    featured: true,
  },
  {
    term: "LIFETIME",
    name: "Founder's",
    price: rupees(PRICES.LIFETIME),
    cadence: "once",
    ribbon: "Pays for itself in 15 months",
    blurb: "Paid once, yours permanently. No renewal, ever.",
  },
];

/**
 * Only what is actually built. Anything on this list is something a paying
 * customer can go and find in the app today.
 */
export const PREMIUM_FEATURES: {
  icon: LucideIcon;
  title: string;
  detail: string;
}[] = [
  {
    icon: History,
    title: "Unlimited history",
    detail: `Every session and meal you have logged, not just the last ${FREE_HISTORY_DAYS} days.`,
  },
  {
    icon: Camera,
    title: "Progress photos",
    detail: "Any two dates, side by side, in the same pose.",
  },
  {
    icon: Sparkles,
    title: "AI meals & voice logging",
    detail: "Photograph a plate or speak a set — it comes back as data.",
  },
  {
    icon: TrendingUp,
    title: "Strength progression",
    detail: "A chart per lift, so you can watch the line move.",
  },
  {
    icon: Trophy,
    title: "Personal records",
    detail: "Every PR caught as you hit it, and kept.",
  },
  {
    icon: Download,
    title: "Export everything",
    detail: "Your whole log as JSON or CSV, whenever you want it.",
  },
];
