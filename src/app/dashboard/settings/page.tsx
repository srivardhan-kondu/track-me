import { RoleSwitcher } from "@/components/settings/role-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { googleEnabled } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { cn, initials } from "@/lib/utils";
import { safeZone } from "@/lib/tz";
import { aiEnabled } from "@/services/ai/client";
import { storageProvider, usingObjectStorage } from "@/services/storage";

export const metadata = { title: "Settings" };

function Panel({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description?: string;
  tone?: "default" | "sage";
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-[22px]",
        tone === "sage"
          ? "border-sage-line bg-sage-soft"
          : "border-line-strong bg-surface",
      )}
    >
      <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
      {description && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-dim">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** One wired-up service, and whether this deployment actually has it. */
function ServiceRow({
  name,
  detail,
  live,
}: {
  name: string;
  detail: string;
  live: boolean;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <span
        className={cn(
          "mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full",
          live ? "bg-sage" : "bg-line-strong",
        )}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[12.5px] font-medium",
            live ? "text-fg" : "text-fg-muted",
          )}
        >
          {name}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-dim">
          {detail}
        </p>
      </div>

      <span
        className={cn(
          "mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em]",
          live ? "text-sage-text" : "text-fg-faint",
        )}
      >
        {live ? "Live" : "Off"}
      </span>
    </li>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();

  const coaches = await db.coachAthlete.findMany({
    where: { athleteId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      coach: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return (
    <>
      <div className="min-w-0">
        <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
          Settings
        </h1>
        <p className="mt-2.5 text-[13px] text-fg-dim">
          Your account, your coach, and what&apos;s wired up.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-line-strong bg-surface p-[22px]">
            <div className="flex items-center gap-3.5">
              <Avatar className="h-11 w-11">
                {user.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback className="text-[12px]">
                  {initials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-fg">
                  {user.name ?? "Unnamed"}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-fg-dim">
                  {user.email}
                </p>
              </div>

              <Badge>{user.role === "COACH" ? "Coach" : "Athlete"}</Badge>
            </div>
          </section>

          <Panel
            title="Mode"
            description="Log your own training, or monitor athletes."
          >
            <RoleSwitcher role={user.role} />
          </Panel>

          <Panel title="Where your days are counted">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[12.5px] text-fg-muted">Time zone</p>
              <p className="tabular rounded-lg border border-line-strong px-3 py-1.5 font-mono text-[12px] text-fg">
                {safeZone(user.timeZone)}
              </p>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-fg-dim">
              Detected from your browser, and kept up to date as you travel.
              Every day boundary — meals, weigh-ins, the timeline — uses it.
            </p>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel
            title="Your coach"
            description="Anyone listed here can see your timeline and leave notes on it."
            tone="sage"
          >
            {coaches.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-fg-muted">
                No coach is monitoring you yet. Ask your trainer to add you by
                the email you signed up with,{" "}
                <span className="font-mono text-[12px] text-fg">
                  {user.email}
                </span>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {coaches.map(({ coach, createdAt }) => (
                  <li key={coach.id} className="flex items-center gap-3">
                    <Avatar>
                      {coach.image && <AvatarImage src={coach.image} alt="" />}
                      <AvatarFallback>
                        {initials(coach.name, coach.email)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-fg">
                        {coach.name ?? "Coach"}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-fg-muted">
                        Can see your timeline · since{" "}
                        {createdAt.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Connected services"
            description="What this deployment currently has configured."
          >
            <ul className="flex flex-col">
              <ServiceRow
                name="Google sign-in"
                live={googleEnabled}
                detail={
                  googleEnabled
                    ? "OAuth configured."
                    : "Not configured — using the local development sign-in."
                }
              />
              <ServiceRow
                name="Voice & vision"
                live={aiEnabled}
                detail={
                  aiEnabled
                    ? "Transcription and nutrition analysis are live."
                    : "No API key — meals fall back to the offline estimator and voice notes are stored but not transcribed."
                }
              />
              <ServiceRow
                name="Media storage"
                live={usingObjectStorage}
                detail={
                  usingObjectStorage
                    ? `Photos and voice notes are stored in ${storageProvider}.`
                    : "Not configured — media is written to .uploads/ on this machine. This cannot work in production."
                }
              />
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
