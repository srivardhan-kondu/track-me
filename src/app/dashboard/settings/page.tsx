import { ExportData } from "@/components/billing/export-data";
import { Upgrade } from "@/components/billing/upgrade";
import { CoachAccess } from "@/components/settings/coach-access";
import { RoleSwitcher } from "@/components/settings/role-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { googleEnabled } from "@/lib/auth";
import { checkoutEnabled, liveMode } from "@/lib/razorpay";
import { premiumStatus, requireUser } from "@/lib/session";
import { cn, initials } from "@/lib/utils";
import { safeZone } from "@/lib/tz";
import { aiEnabled } from "@/services/ai/client";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCoachLinksForAthlete } from "@/services/reporting";
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

/** One line describing what the account currently has, and until when. */
function planSummary(status: {
  plan: string;
  planExpiresAt: Date | null;
  trialEndsAt: Date | null;
  premium: boolean;
  trialing: boolean;
}): { label: string; detail: string } {
  const on = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  if (status.plan === "PREMIUM" && !status.planExpiresAt) {
    return { label: "Lifetime", detail: "Paid once. Nothing to renew." };
  }
  if (status.premium && !status.trialing) {
    return {
      label: "Premium",
      detail: `Renews on ${on(status.planExpiresAt!)}.`,
    };
  }
  if (status.trialing) {
    return {
      label: "Trial",
      detail: `Free premium until ${on(status.trialEndsAt!)}.`,
    };
  }
  return {
    label: "Free",
    detail: "Workout logging, routines and weight tracking.",
  };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const status = await premiumStatus(user.id);
  const plan = planSummary(status);

  const coachLinks = await getCoachLinksForAthlete(user.id);

  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { gender: true, age: true, heightCm: true },
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

              <Badge variant={status.premium ? "default" : "secondary"}>
                {plan.label}
              </Badge>
            </div>
          </section>

          <Panel
            title="About you"
            description="What onboarding asked for. Change or clear any of it."
          >
            <ProfileForm
              gender={profile?.gender ?? null}
              age={profile?.age ?? null}
              heightCm={profile?.heightCm ?? null}
            />
          </Panel>

          <Panel title="Plan" description={plan.detail}>
            {checkoutEnabled ? (
              <>
                <Upgrade currentTerm={status.planTerm} />
                {!liveMode && (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-fg-dim">
                    Razorpay is in test mode on this deployment — use a test
                    card. No money moves.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-fg-muted">
                Payments are not configured here. Set RAZORPAY_KEY_ID and
                RAZORPAY_KEY_SECRET to enable the payment sheet.
              </p>
            )}
          </Panel>

          {status.premium && (
            <Panel
              title="Your data"
              description="Take a copy whenever you like. Photographs are referenced by key rather than by link, since the links the app serves expire within the hour."
            >
              <ExportData />
            </Panel>
          )}

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
            description="A coach sees nothing until you allow it, and you can withdraw that at any time."
            tone="sage"
          >
            <CoachAccess
              pending={coachLinks.pending}
              accepted={coachLinks.accepted}
              email={user.email}
            />
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
                live={aiEnabled()}
                detail={
                  aiEnabled()
                    ? "Transcription and nutrition analysis are live."
                    : "No API key — meals fall back to the offline estimator and voice notes are stored but not transcribed."
                }
              />
              <ServiceRow
                name="Payments"
                live={checkoutEnabled && liveMode}
                detail={
                  !checkoutEnabled
                    ? "No API keys — the payment sheet is hidden."
                    : liveMode
                      ? "Razorpay Checkout is taking real payments."
                      : "Razorpay test keys — the sheet works, but no money moves."
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
