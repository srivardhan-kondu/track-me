import { Plus } from "lucide-react";

import { ATHLETE_NAV, COACH_NAV } from "@/components/layout/nav";
import { AppShell } from "@/components/layout/shell";
import { TimeZoneSync } from "@/components/layout/timezone-sync";
import { MealForm } from "@/components/log/meal-form";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <TimeZoneSync current={user.timeZone} />

      <AppShell
        groups={user.role === "COACH" ? COACH_NAV : ATHLETE_NAV}
        user={user}
        mobileAction={
          <MealForm
            trigger={
              <button
                type="button"
                aria-label="Log a meal"
                className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_10px_26px_-8px_var(--accent)] transition-transform active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </button>
            }
          />
        }
      >
        {children}
      </AppShell>
    </>
  );
}
