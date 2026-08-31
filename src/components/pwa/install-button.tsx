"use client";

import * as React from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "trackme-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari predates the display-mode media query.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Offers to install the app to the home screen.
 *
 * Chrome and Edge fire `beforeinstallprompt`, which can be deferred and
 * replayed on a click. Safari has no such event, so iOS gets instructions for
 * the Share sheet instead — without them the button would do nothing on the
 * platform where installing matters most.
 */
export function InstallButton({
  variant = "default",
  className,
}: {
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}) {
  const [promptEvent, setPromptEvent] =
    React.useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(true);
  const [showIosHelp, setShowIosHelp] = React.useState(false);
  const [ios, setIos] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (ios || !promptEvent) {
      setShowIosHelp(true);
      return;
    }
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setInstalled(true);
    // The event is single-use whichever way it went.
    setPromptEvent(null);
  }

  // Already installed, or nothing to offer on this browser.
  if (installed) return null;
  if (!promptEvent && !ios) return null;
  if (dismissed) return null;

  return (
    <>
      <Button
        variant={variant}
        className={cn("gap-2", className)}
        onClick={install}
      >
        <Download className="h-4 w-4" />
        Install app
      </Button>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Track Me to your home screen</DialogTitle>
            <DialogDescription>
              Safari installs web apps from the Share menu.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                1
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                Tap <Share className="inline h-4 w-4 text-primary" />
                <strong>Share</strong> at the bottom of Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                2
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                Scroll and choose{" "}
                <SquarePlus className="inline h-4 w-4 text-primary" />
                <strong>Add to Home Screen</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                3
              </span>
              <span>
                Tap <strong>Add</strong>. Track Me opens full screen, with the
                camera and microphone ready.
              </span>
            </li>
          </ol>

          <p className="text-xs text-muted-foreground">
            This works in Safari only — Chrome on iOS cannot install web apps.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A dismissible banner for the dashboard, shown until installed or waved off. */
export function InstallBanner() {
  const [visible, setVisible] = React.useState(false);
  const [ios, setIos] = React.useState(false);
  const [promptAvailable, setPromptAvailable] = React.useState(false);

  React.useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Storage blocked; show the banner rather than hiding it forever.
    }

    setIos(isIos());
    const onPrompt = () => setPromptAvailable(true);
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires the event, so offer the instructions route instead.
    setVisible(isIos());
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  React.useEffect(() => {
    if (promptAvailable) setVisible(true);
  }, [promptAvailable]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Dismissal simply will not persist.
    }
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10">
        <Download className="h-4 w-4 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Add Track Me to your home screen</p>
        <p className="text-xs text-muted-foreground">
          {ios
            ? "Opens full screen, straight to the camera."
            : "Log a meal in two taps, without opening a browser."}
        </p>
      </div>

      <InstallButton variant="outline" className="shrink-0" />

      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Dismiss"
        className="h-7 w-7 shrink-0 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
