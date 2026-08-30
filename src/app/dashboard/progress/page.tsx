import { ProgressPhotoCard } from "@/components/log/progress-photo-card";
import { ProgressUploader } from "@/components/log/progress-uploader";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Progress photos" };

const POSE_ORDER = ["FRONT", "SIDE", "BACK"] as const;

export default async function ProgressPage() {
  const user = await requireUser();

  const photos = await db.progressPhoto.findMany({
    where: { userId: user.id },
    orderBy: { takenAt: "desc" },
  });

  const resolved = await Promise.all(
    photos.map(async (p) => ({ ...p, url: await mediaUrl(p.imageKey) })),
  );

  // Monthly history, as the spec calls for.
  const months = new Map<string, typeof resolved>();
  for (const photo of resolved) {
    const key = `${photo.takenAt.getFullYear()}-${String(
      photo.takenAt.getMonth() + 1,
    ).padStart(2, "0")}`;
    const bucket = months.get(key);
    if (bucket) bucket.push(photo);
    else months.set(key, [photo]);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Progress photos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Front, side and back — one set a month is plenty.
          </p>
        </div>
        <ProgressUploader />
      </header>

      {months.size === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <p className="text-sm font-medium">No progress photos yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Take your first set today — it becomes the baseline everything else
            is measured against.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
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
              <section key={key}>
                <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold">
                  {label}
                </h2>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {ordered.map((photo) => (
                    <ProgressPhotoCard
                      key={photo.id}
                      id={photo.id}
                      url={photo.url}
                      pose={
                        photo.pose.charAt(0) + photo.pose.slice(1).toLowerCase()
                      }
                      takenAt={photo.takenAt.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                      canDelete
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
