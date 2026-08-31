import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { ATHLETE_NAV, COACH_NAV } from "@/components/layout/nav";
import { AppShell } from "@/components/layout/shell";
import { TimeZoneSync } from "@/components/layout/timezone-sync";
import { MealForm } from "@/components/log/meal-form";
import { TrialStrip } from "@/components/billing/trial-strip";
import { db } from "@/lib/db";
import { trialDaysLeft } from "@/lib/entitlements";
import { premiumStatus, requireUser } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const daysLeft = trialDaysLeft(await premiumStatus(user.id));

  /*
    Athletes meet onboarding once, before anything else. Coaches never do —
    the flow asks about training a body they are not tracking here.
  */
  if (user.role === "ATHLETE") {
    const record = await db.user.findUnique({
      where: { id: user.id },
      select: { onboardedAt: true },
    });
    if (!record?.onboardedAt) redirect("/onboarding");
  }

  return (
    <>
      <TimeZoneSync current={user.timeZone} />

      <AppShell
        groups={user.role === "COACH" ? COACH_NAV : ATHLETE_NAV}
        user={user}
        banner={daysLeft !== null && <TrialStrip daysLeft={daysLeft} />}
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
