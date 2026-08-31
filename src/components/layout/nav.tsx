"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Camera,
  Dumbbell,
  Scale,
  TrendingUp,
  UtensilsCrossed,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  /** Short form for the mobile bar, where space is measured in pixels. */
  short: string;
  icon: React.ElementType;
  /** Only the index route matches exactly; the rest match by prefix. */
  exact?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

/** The athlete's rail, grouped by what the section is for. */
export const ATHLETE_NAV: NavGroup[] = [
  {
    label: "Today",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        short: "Today",
        icon: CalendarDays,
        exact: true,
      },
    ],
  },
  {
    label: "Log",
    items: [
      {
        href: "/dashboard/meals",
        label: "Meals",
        short: "Meals",
        icon: UtensilsCrossed,
      },
      {
        href: "/dashboard/workouts",
        label: "Workouts",
        short: "Training",
        icon: Dumbbell,
      },
    ],
  },
  {
    label: "Body",
    items: [
      {
        href: "/dashboard/strength",
        label: "Strength",
        short: "Strength",
        icon: TrendingUp,
      },
      { href: "/dashboard/weight", label: "Weight", short: "Weight", icon: Scale },
      {
        href: "/dashboard/progress",
        label: "Photos",
        short: "Photos",
        icon: Camera,
      },
    ],
  },
];

/** The coach's rail. Their own logging stays one click away. */
export const COACH_NAV: NavGroup[] = [
  {
    label: "Coaching",
    items: [
      { href: "/trainer", label: "Athletes", short: "Athletes", icon: Users, exact: true },
    ],
  },
  {
    label: "My training",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        short: "Today",
        icon: CalendarDays,
        exact: true,
      },
      {
        href: "/dashboard/meals",
        label: "Meals",
        short: "Meals",
        icon: UtensilsCrossed,
      },
      {
        href: "/dashboard/workouts",
        label: "Workouts",
        short: "Training",
        icon: Dumbbell,
      },
    ],
  },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-[3px]">
          <p className="mono-label px-2.5 pb-2">{group.label}</p>

          {group.items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] transition-colors",
                  active
                    ? "bg-accent-soft font-semibold text-fg"
                    : "font-medium text-fg-muted hover:bg-hover hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                    active ? "bg-accent" : "bg-line-strong",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * Thumb-first bottom bar. Destinations sit flat across the bottom; logging
 * gets the one big amber button, floated clear of them.
 */
export function BottomNav({
  groups,
  action,
}: {
  groups: NavGroup[];
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = groups.flatMap((g) => g.items);

  return (
    <>
      {action && (
        <div className="fixed bottom-[calc(66px+env(safe-area-inset-bottom))] right-4 z-40 md:hidden">
          {action}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-sunken/95 backdrop-blur md:hidden">
        <div
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-2.5 transition-colors",
                  active ? "text-fg" : "text-fg-faint",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span
                  className={cn(
                    "font-mono text-[9.5px] uppercase tracking-[0.1em]",
                    active && "font-semibold",
                  )}
                >
                  {item.short}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Keeps the bar clear of the iOS home indicator. */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
