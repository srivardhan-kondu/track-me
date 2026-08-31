import { COACH_NAV } from "@/components/layout/nav";
import { AppShell } from "@/components/layout/shell";
import { TimeZoneSync } from "@/components/layout/timezone-sync";
import { requireCoach } from "@/lib/session";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCoach();

  return (
    <>
      <TimeZoneSync current={user.timeZone} />

      <AppShell groups={COACH_NAV} user={user} badge="Coach">
        {children}
      </AppShell>
    </>
  );
}
