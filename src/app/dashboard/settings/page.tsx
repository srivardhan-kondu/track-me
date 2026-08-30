import { CheckCircle2, CircleDashed } from "lucide-react";

import { RoleSwitcher } from "@/components/settings/role-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { googleEnabled } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { initials } from "@/lib/utils";
import { aiEnabled } from "@/services/ai/client";
import { storageProvider, usingObjectStorage } from "@/services/storage";

export const metadata = { title: "Settings" };

function IntegrationRow({
  name,
  active,
  activeLabel,
  inactiveLabel,
}: {
  name: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      {active ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
      ) : (
        <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {active ? activeLabel : inactiveLabel}
        </p>
      </div>
    </li>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();

  const coaches = await db.coachAthlete.findMany({
    where: { athleteId: user.id },
    include: {
      coach: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account and how GymOS is wired up.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name ?? "Unnamed"}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
          <Badge className="ml-auto" variant="secondary">
            {user.role === "COACH" ? "Coach" : "Athlete"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mode</CardTitle>
          <CardDescription>
            Switch between logging your own training and monitoring athletes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RoleSwitcher role={user.role} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your coaches</CardTitle>
          <CardDescription>
            Anyone listed here can see your timeline and leave feedback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coaches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No coach is monitoring you yet. Ask your trainer to add you by
              your email address, {user.email}.
            </p>
          ) : (
            <ul className="space-y-3">
              {coaches.map(({ coach }) => (
                <li key={coach.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {coach.image && <AvatarImage src={coach.image} alt="" />}
                    <AvatarFallback className="text-[10px]">
                      {initials(coach.name, coach.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {coach.name ?? "Coach"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {coach.email}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>
            What this deployment currently has configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            <IntegrationRow
              name="Google sign-in"
              active={googleEnabled}
              activeLabel="OAuth configured."
              inactiveLabel="Not configured — using the local development sign-in."
            />
            <IntegrationRow
              name="OpenAI (Whisper + Vision)"
              active={aiEnabled}
              activeLabel="Transcription and nutrition analysis are live."
              inactiveLabel="No API key — meals fall back to the offline estimator and voice notes are stored but not transcribed."
            />
            <IntegrationRow
              name="Object storage"
              active={usingObjectStorage}
              activeLabel={`Media is stored in ${storageProvider}.`}
              inactiveLabel="Not configured — media is written to .uploads/ on this machine. This cannot work in production."
            />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
