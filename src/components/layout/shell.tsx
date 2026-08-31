import Link from "next/link";

import { Mark } from "@/components/layout/mark";
import { BottomNav, SidebarNav, type NavGroup } from "@/components/layout/nav";
import { UserCard, UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/layout/site-footer";

export function Logo({
  href = "/dashboard",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex min-w-0 items-center gap-2.5 text-fg", className)}
    >
      <Mark size={26} />
      <span className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">
        Track Me
      </span>
    </Link>
  );
}

/**
 * The frame every signed-in screen sits in: a grouped rail on the left, the
 * page in the middle, and on a phone a thumb-first bar along the bottom.
 */
export function AppShell({
  groups,
  user,
  badge,
  banner,
  mobileAction,
  children,
}: {
  groups: NavGroup[];
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    role: "ATHLETE" | "COACH";
    isAdmin?: boolean;
  };
  /** A word beside the logo, for the coach's side of the app. */
  badge?: string;
  /** Sits above every page — the trial countdown, and nothing else. */
  banner?: React.ReactNode;
  /** The one big logging button on mobile. */
  mobileAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const home =
    badge === "Admin"
      ? "/admin"
      : user.role === "COACH"
        ? "/trainer"
        : "/dashboard";

  return (
    <div className="min-h-dvh md:flex">
      <aside className="gutter-x sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-line bg-bg-sunken pb-5 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] [--gutter:1rem] md:flex">
        <div className="flex min-w-0 items-center gap-2 px-2 pb-7">
          <Logo href={home} />
          {badge && (
            <span className="shrink-0 rounded-full bg-surface-inset px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-fg-muted">
              {badge}
            </span>
          )}
        </div>

        <SidebarNav groups={groups} />

        <div className="mt-auto flex flex-col gap-2 pt-6">
          <UserCard
            name={user.name}
            email={user.email}
            image={user.image}
            role={user.role}
            isAdmin={user.isAdmin}
          />

          <Link
            href="/dashboard/settings"
            className="pl-3 text-[12.5px] font-medium text-fg-dim transition-colors hover:text-fg"
          >
            Settings
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          The bar carries the status bar's height itself: the app is installed
          with a translucent status bar over a cover-fit viewport, so without
          the inset the wordmark is printed under the clock. `min-h` keeps a
          full 3.5rem of bar below whatever the notch takes.
        */}
        <header className="gutter-x safe-t sticky top-0 z-30 flex min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] items-center justify-between gap-3 border-b border-line bg-bg/90 backdrop-blur [--gutter:1rem] md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Logo href={home} />
            {badge && (
              <span className="shrink-0 rounded-full bg-surface-inset px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-fg-muted">
                {badge}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              role={user.role}
              isAdmin={user.isAdmin}
            />
          </div>
        </header>

        <main className="gutter-x min-w-0 flex-1 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-6 [--gutter:1rem] sm:[--gutter:1.5rem] md:pb-12 md:pt-9 md:[--gutter:2.5rem]">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
            {banner}

            {children}

            {/*
              The policies have to be reachable from inside the app, not only
              from the marketing pages — someone who signs in and never
              navigates back out would otherwise never find them, which is
              exactly what a payment gateway's reviewer does.
            */}
            <SiteFooter className="mt-6" />
          </div>
        </main>
      </div>

      <BottomNav groups={groups} action={mobileAction} />
    </div>
  );
}
