import { EmptyState } from "@/components/layout/page";
import { ProgressPhotoCard } from "@/components/log/progress-photo-card";
import { ProgressUploader } from "@/components/log/progress-uploader";
import { db } from "@/lib/db";
import { PremiumNotice } from "@/components/billing/premium-notice";
import { premiumStatus, requireUser } from "@/lib/session";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Progress photos" };

const POSE_ORDER = ["FRONT", "SIDE", "BACK"] as const;

type Resolved = {
  id: string;
  pose: string;
  takenAt: Date;
  url: string | null;
};

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** The check-in nearest a photo, so a comparison carries its numbers. */
function weightNear(
  weights: { day: Date; weightKg: number }[],
  at: Date,
): number | null {
  if (weights.length === 0) return null;
  let best = weights[0];
  for (const w of weights) {
    if (
      Math.abs(new Date(w.day).getTime() - at.getTime()) <
      Math.abs(new Date(best.day).getTime() - at.getTime())
    ) {
      best = w;
    }
  }
  return best.weightKg;
}

function CompareTile({
  photo,
  weightKg,
  caption,
  highlight,
}: {
  photo: Resolved;
  weightKg: number | null;
  caption: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={
          highlight
            ? "mono-label mb-2.5 text-accent-text"
            : "mono-label mb-2.5"
        }
      >
        {shortDate(photo.takenAt)}
        {weightKg !== null && ` · ${weightKg} kg`}
      </p>

      <div className="relative h-[260px] overflow-hidden rounded-xl border border-line bg-surface-inset">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={caption} className="h-full w-full object-cover" />
        ) : (
          <div className="hatched h-full w-full" />
        )}

        <span className="absolute bottom-2.5 left-2.5 rounded bg-black/55 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/90 backdrop-blur">
          {caption}
        </span>
      </div>
    </div>
  );
}

export default async function ProgressPage() {
  const user = await requireUser();
  const { premium } = await premiumStatus(user.id);

  const [photos, weights] = await Promise.all([
    db.progressPhoto.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "desc" },
    }),
    db.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { day: "asc" },
      select: { day: true, weightKg: true },
    }),
  ]);

  const resolved: Resolved[] = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      pose: p.pose,
      takenAt: p.takenAt,
      url: await mediaUrl(p.imageKey),
    })),
  );

  // Compare like with like: the same pose where possible, front by preference.
  const poseWithMost = POSE_ORDER.map((pose) => ({
    pose,
    shots: resolved.filter((p) => p.pose === pose),
  })).sort((a, b) => b.shots.length - a.shots.length)[0];

  const comparable =
    poseWithMost && poseWithMost.shots.length > 1 ? poseWithMost.shots : resolved;

  const baseline = comparable[comparable.length - 1] ?? null;
  const latest = comparable[0] ?? null;
  const canCompare = baseline !== null && latest !== null && baseline.id !== latest.id;

  // Monthly history, as the spec calls for.
  const months = new Map<string, Resolved[]>();
  for (const photo of resolved) {
    const key = `${photo.takenAt.getFullYear()}-${String(
      photo.takenAt.getMonth() + 1,
    ).padStart(2, "0")}`;
    const bucket = months.get(key);
    if (bucket) bucket.push(photo);
    else months.set(key, [photo]);
  }

  const thisMonth = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-xl">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Progress photos
          </h1>
          <p className="mt-2.5 text-[13px] leading-relaxed text-fg-dim">
            Front, side and back — one set a month is plenty. Only you and your
            coach can see these.
          </p>
        </div>

        {premium && <ProgressUploader />}
      </div>

      {!premium && (
        <PremiumNotice
          title="Progress photos are part of Premium"
          body="Anything you have already uploaded stays here and stays yours. Premium adds new photos, the side-by-side comparison and AI physique analysis."
        />
      )}

      {canCompare && premium && (
        <section className="grid grid-cols-2 gap-4 rounded-2xl border border-line-strong bg-surface-muted p-5">
          <CompareTile
            photo={baseline}
            weightKg={weightNear(weights, baseline.takenAt)}
            caption={`${baseline.pose.toLowerCase()} · baseline`}
          />
          <CompareTile
            photo={latest}
            weightKg={weightNear(weights, latest.takenAt)}
            caption={`${latest.pose.toLowerCase()} · latest`}
            highlight
          />
        </section>
      )}

      {months.size === 0 ? (
        <EmptyState
          title="No progress photos yet"
          body="Take your first set today — front, side and back, same lighting each time. It becomes the baseline everything else is measured against."
          action={premium ? <ProgressUploader /> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {[...months.entries()].map(([key, monthPhotos]) => {
            const [year, month] = key.split("-").map(Number);
            const label = new Date(year, month - 1, 1).toLocaleDateString(
              undefined,
              { month: "long", year: "numeric" },
            );

            const ordered = monthPhotos.slice().sort((a, b) => {
              const byPose =
                POSE_ORDER.indexOf(a.pose as (typeof POSE_ORDER)[number]) -
                POSE_ORDER.indexOf(b.pose as (typeof POSE_ORDER)[number]);
              if (byPose !== 0) return byPose;
              return b.takenAt.getTime() - a.takenAt.getTime();
            });

            return (
              <section key={key} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-[12.5px] font-semibold text-fg">
                    {label}
                  </h2>
                  <span className="h-px flex-1 bg-line" />
                  <span className="mono-label">
                    {ordered.length} photo{ordered.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {ordered.map((photo) => (
                    <ProgressPhotoCard
                      key={photo.id}
                      id={photo.id}
                      url={photo.url}
                      pose={photo.pose.toLowerCase()}
                      takenAt={shortDate(photo.takenAt)}
                      canDelete
                    />
                  ))}

                  {key === thisMonth && premium && (
                    <ProgressUploader
                      trigger={
                        <button
                          type="button"
                          className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[11px] border border-dashed border-line-strong text-fg-dim transition-colors hover:border-accent-line hover:text-fg"
                        >
                          <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-current text-sm leading-none">
                            +
                          </span>
                          <span className="mono-label">Add</span>
                        </button>
                      }
                    />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
