"use client";

import * as React from "react";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
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
const BAR_COUNT = 32;

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
  const [levels, setLevels] = React.useState<number[]>(
    () => new Array(BAR_COUNT).fill(0.06),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);

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
          Math.max(0.06, Math.min(1, peak * 1.9)),
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
    setLevels(new Array(BAR_COUNT).fill(0.06));
  }

  function reset() {
    onChange(null);
    setElapsed(0);
    setPlaying(false);
  }

  function togglePlayback() {
    const el = audioElRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        {recording && (
          <span className="tabular text-xs text-muted-foreground">
            {formatDuration(elapsed)} / {formatDuration(MAX_SECONDS)}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        {!value && !recording && (
          <div className="flex items-center gap-3">
            <Button type="button" onClick={start} size="sm" className="gap-2">
              <Mic className="h-4 w-4" />
              Record
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {hint}
            </p>
          </div>
        )}

        {recording && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={stop}
              size="sm"
              variant="destructive"
              className="gap-2"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>

            <div
              className="flex h-8 flex-1 items-center gap-[2px]"
              aria-hidden="true"
            >
              {levels.map((lvl, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full bg-primary/70"
                  style={{ height: `${Math.round(lvl * 100)}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {value && !recording && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={togglePlayback}
              size="icon"
              variant="outline"
              aria-label={playing ? "Pause" : "Play recording"}
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <div className="flex-1">
              <p className="text-sm font-medium">Voice note ready</p>
              <p className="tabular text-xs text-muted-foreground">
                {formatDuration(elapsed)} · {(value.size / 1024).toFixed(0)} KB
              </p>
            </div>

            <Button
              type="button"
              onClick={reset}
              size="icon"
              variant="ghost"
              aria-label="Discard recording"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            {previewUrl && (
              <audio
                ref={audioElRef}
                src={previewUrl}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
            )}
          </div>
        )}
      </div>

      {error && (
        <p className={cn("text-xs", "text-destructive")} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
