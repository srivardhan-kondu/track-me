import fs from "node:fs";
import path from "node:path";

import { cn } from "@/lib/utils";

type Gender = "FEMALE" | "MALE" | null | undefined;

/**
 * Each athlete has two frames of the same shot: a tall one for the narrow slot
 * beside the greeting on a phone, and a wide one for the desktop card, where a
 * tall frame would be cropped down to a sliver of shoulder.
 */
const PORTRAITS: Record<"FEMALE" | "MALE", { tall: string; wide: string }> = {
  FEMALE: {
    tall: "/athletes/female.webp",
    wide: "/athletes/female-wide.webp",
  },
  MALE: {
    tall: "/athletes/male.webp",
    wide: "/athletes/male-wide.webp",
  },
};

/**
 * Left-edge and bottom-edge falloff, applied together.
 *
 * The bottom stop is fully transparent by 74% because the figures strip starts
 * at roughly 75-80% of the card. Fading any later leaves the photo faintly
 * visible in the padding beside that strip, which reads as a stray edge.
 */
const FADE = [
  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 34%, #000 72%)",
  "linear-gradient(to bottom, #000 40%, transparent 74%)",
].join(", ");

function onDisk(src: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", src));
}

/**
 * The portrait behind the greeting. Female athletes get the female photo, male
 * athletes the male one; anyone who skipped the question gets the gradient.
 *
 * The files are optional on purpose. A portrait that has not been added yet
 * would otherwise render as a broken image on every page load, so existence is
 * checked once here — this is a server component, so the check costs a stat
 * call at render and never reaches the browser. The wide frame is optional
 * even when the tall one exists: missing it just means both breakpoints use
 * the tall crop.
 */
export function AthletePortrait({
  gender,
  className,
  priority,
}: {
  gender: Gender;
  className?: string;
  /** Set on the one portrait that is above the fold. */
  priority?: boolean;
}) {
  const set =
    gender === "FEMALE" || gender === "MALE" ? PORTRAITS[gender] : null;

  const tall = set && onDisk(set.tall) ? set.tall : null;
  const wide = set && onDisk(set.wide) ? set.wide : null;
  const fallback = tall ?? wide;

  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden>
      {fallback ? (
        /*
          A <picture> rather than next/image: the two frames are different
          crops, not two sizes of one image, so the choice has to be made by
          media query and only the chosen file should ever be fetched. The
          files are already sized and compressed to webp at build time, which
          is the part the optimiser would otherwise have done.

          The photo is masked rather than covered by a coloured overlay: an
          overlay has to guess the card's colour behind it and leaves a visible
          seam wherever the guess is wrong, while a mask fades the pixels
          themselves and blends into whatever the card actually is.
        */
        <picture>
          {wide && tall && (
            <source media="(min-width: 768px)" srcSet={wide} type="image/webp" />
          )}
          <img
            src={fallback}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-top"
            style={{
              maskImage: FADE,
              WebkitMaskImage: FADE,
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
        </picture>
      ) : (
        <div className="accent-gradient h-full w-full opacity-70" />
      )}
    </div>
  );
}
