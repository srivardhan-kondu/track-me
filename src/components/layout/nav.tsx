"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Camera,
  CreditCard,
  Droplets,
  Dumbbell,
  Gauge,
  ListChecks,
  Scale,
  ScrollText,
  ServerCog,
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
      {
        href: "/dashboard/water",
        label: "Water",
        short: "Water",
        icon: Droplets,
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

/**
 * The admin rail, grouped by the question each section answers: is the
 * business working, is the system healthy, and what has been done to it.
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Console",
    items: [
      { href: "/admin", label: "Overview", short: "Overview", icon: Gauge, exact: true },
      { href: "/admin/users", label: "Users", short: "Users", icon: Users },
      {
        href: "/admin/payments",
        label: "Payments",
        short: "Money",
        icon: CreditCard,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/jobs", label: "Queue", short: "Queue", icon: ListChecks },
      { href: "/admin/system", label: "System", short: "System", icon: ServerCog },
      { href: "/admin/audit", label: "Audit log", short: "Audit", icon: ScrollText },
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
                  "flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[13.5px] transition-colors",
                  active
                    ? "bg-accent-soft font-semibold text-fg"
                    : "font-medium text-fg-muted hover:bg-hover hover:text-fg",
                )}
              >
                <item.icon
                  className={cn(
                    "h-[17px] w-[17px] shrink-0 transition-colors",
                    active ? "text-accent-text" : "text-fg-faint",
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
 * gets the one big violet button, floated clear of them.
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
        <div className="fixed bottom-[calc(66px+env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-40 md:hidden">
          {action}
        </div>
      )}

      {/* `safe-b` keeps the bar clear of the iOS home indicator. */}
      <nav className="safe-b gutter-x fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-sunken/92 backdrop-blur-xl [--gutter:0px] md:hidden">
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
                  "flex min-w-0 flex-col items-center gap-1.5 px-0.5 py-3 transition-colors",
                  active ? "text-accent-text" : "text-fg-faint",
                )}
              >
                <Icon className="h-[19px] w-[19px] shrink-0" />
                <span
                  className={cn(
                    "max-w-full truncate text-[10px] tracking-[0.01em]",
                    active ? "font-bold" : "font-medium",
                  )}
                >
                  {item.short}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
