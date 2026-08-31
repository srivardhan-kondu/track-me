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
      className={cn("flex items-center gap-2.5 text-fg", className)}
    >
      <Mark size={26} />
      <span className="text-[14.5px] font-semibold tracking-[-0.01em]">
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
  mobileAction,
  children,
}: {
  groups: NavGroup[];
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    role: "ATHLETE" | "COACH";
  };
  /** A word beside the logo, for the coach's side of the app. */
  badge?: string;
  /** The one big logging button on mobile. */
  mobileAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const home = user.role === "COACH" ? "/trainer" : "/dashboard";

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-line bg-bg-sunken px-4 pb-5 pt-6 md:flex">
        <div className="flex items-center gap-2 px-2 pb-7">
          <Logo href={home} />
          {badge && (
            <span className="rounded-full bg-surface-inset px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-fg-muted">
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Logo href={home} />
            {badge && (
              <span className="rounded-full bg-surface-inset px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-fg-muted">
                {badge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              role={user.role}
            />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-9">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
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
