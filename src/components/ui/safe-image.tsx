"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * An `<img>` that swaps to `fallback` when the file cannot be loaded.
 *
 * Media URLs are always produced, whether or not the object behind them still
 * exists (a deleted upload, an expired presigned link, seeded rows with no
 * file). Without this the browser draws its broken-image icon with the alt
 * text spilled over it.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A server-rendered image can fail before React attaches onError, so the
  // event is never seen. Check once after hydration as well.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
