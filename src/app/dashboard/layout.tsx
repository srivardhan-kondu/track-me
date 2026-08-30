import Link from "next/link";
import { Activity } from "lucide-react";

import { BottomNav, SidebarNav } from "@/components/layout/nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold tracking-tight">GymOS</span>
          </Link>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              role={user.role}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
        <aside className="hidden w-48 shrink-0 md:block">
          <div className="sticky top-20">
            <SidebarNav />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
