"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Camera,
  Dumbbell,
  Scale,
  Settings,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const ATHLETE_NAV = [
  { href: "/dashboard", label: "Today", icon: CalendarDays },
  { href: "/dashboard/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/dashboard/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/dashboard/weight", label: "Weight", icon: Scale },
  { href: "/dashboard/progress", label: "Photos", icon: Camera },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ATHLETE_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, href)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}

      <Link
        href="/dashboard/settings"
        className={cn(
          "mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive(pathname, "/dashboard/settings")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Settings className="h-4 w-4" />
        Settings
      </Link>
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {ATHLETE_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
      {/* Keeps the bar clear of the iOS home indicator. */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
