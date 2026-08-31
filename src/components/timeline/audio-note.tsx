"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

const BAR_COUNT = 28;

/**
 * Bar heights derived from the source key, so the same note always draws the
 * same shape and the server and client agree on the markup.
 */
function waveform(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const unit = ((h >>> 0) % 1000) / 1000;
    // Taper the ends so it reads as a phrase rather than a block.
    const taper = Math.sin((Math.PI * (i + 1)) / (BAR_COUNT + 1)) * 0.35 + 0.65;
    return 0.28 + unit * 0.72 * taper;
  });
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A voice note as a designed waveform rather than the browser's own player,
 * which brings its own light-grey chrome into every card.
 */
export function AudioNote({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  const bars = React.useMemo(() => waveform(src), [src]);
  const progress = duration > 0 ? time / duration : 0;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  }

  function seek(fraction: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[11px] border border-line bg-surface-inset px-3 py-2.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-transform active:scale-95"
      >
        {playing ? (
          <Pause className="h-3 w-3 fill-current" />
        ) : (
          <Play className="ml-0.5 h-3 w-3 fill-current" />
        )}
      </button>

      <div className="relative min-w-0 flex-1">
        <div
          className="flex h-[22px] items-center gap-[2.5px]"
          aria-hidden="true"
          onPointerDown={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - box.left) / box.width);
          }}
        >
          {bars.map((height, i) => (
            <span
              key={i}
              className={cn(
                "w-[2.5px] shrink-0 rounded-[2px] transition-colors",
                i / BAR_COUNT <= progress ? "bg-accent/85" : "bg-line-strong",
              )}
              style={{ height: `${Math.round(height * 20)}px` }}
            />
          ))}
        </div>

        {/* Keyboard and screen-reader route to the same scrub position. */}
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          aria-label="Seek voice note"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      <span className="tabular shrink-0 font-mono text-[11px] text-fg-dim">
        {clock(time)} / {clock(duration)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        className="hidden"
      />
    </div>
  );
}
