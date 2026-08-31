"use client";

import * as React from "react";
import { Mic, RotateCcw, Square } from "lucide-react";

import { AudioNote } from "@/components/timeline/audio-note";
import { cn } from "@/lib/utils";

/** Picks a container the browser can actually record. Safari differs from Chrome. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const MAX_SECONDS = 180;
const BAR_COUNT = 24;
const FLOOR = 0.08;

export function VoiceRecorder({
  value,
  onChange,
  label = "Voice note",
  hint = "Describe what you ate and roughly how much.",
}: {
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
  label?: string;
  hint?: string;
}) {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [levels, setLevels] = React.useState<number[]>(() =>
    new Array(BAR_COUNT).fill(FLOOR),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep an object URL alive only while a recording exists.
  React.useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const teardown = React.useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  React.useEffect(() => teardown, [teardown]);

  async function start() {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("Recording needs a secure (https) connection.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size > 0) onChange(blob);
        teardown();
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          const next = e + 1;
          if (next >= MAX_SECONDS) stop();
          return next;
        });
      }, 1000);

      // Live level meter so the athlete can see the mic is picking them up.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let peak = 0;
        for (const v of buffer) {
          peak = Math.max(peak, Math.abs(v - 128) / 128);
        }
        setLevels((prev) => [
          ...prev.slice(1),
          Math.max(FLOOR, Math.min(1, peak * 1.9)),
        ]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Microphone access was blocked. Check your browser permissions.");
      teardown();
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    setRecording(false);
    setLevels(new Array(BAR_COUNT).fill(FLOOR));
  }

  function reset() {
    onChange(null);
    setElapsed(0);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-fg-muted">{label}</span>
        {(recording || value) && (
          <span className="tabular font-mono text-[11px] text-fg-dim">
            {formatDuration(elapsed)}
            {recording && ` / ${formatDuration(MAX_SECONDS)}`}
          </span>
        )}
      </div>

      {value && !recording ? (
        <div className="flex items-center gap-2.5">
          {previewUrl && <AudioNote src={previewUrl} className="min-w-0 flex-1" />}
          <button
            type="button"
            onClick={reset}
            aria-label="Discard recording and start again"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-line-strong text-fg-dim transition-colors hover:bg-hover hover:text-fg"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-[14px] border border-line bg-surface-inset px-4 py-6">
          <button
            type="button"
            onClick={recording ? stop : start}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className={cn(
              "grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-ink transition-transform active:scale-95",
              recording && "trackme-listening",
            )}
          >
            {recording ? (
              <Square className="h-5 w-5 fill-current" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>

          {recording ? (
            <>
              <div
                className="flex h-9 items-center gap-[3px]"
                aria-hidden="true"
              >
                {levels.map((level, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-accent/70 transition-[height] duration-75"
                    style={{ height: `${Math.max(6, Math.round(level * 34))}px` }}
                  />
                ))}
              </div>
              <p className="mono-label">Tap to finish</p>
            </>
          ) : (
            <p className="max-w-xs text-center text-[12px] leading-relaxed text-fg-dim">
              {hint}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-[11.5px] text-clay-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
