"use client";

import * as React from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  removePushSubscription,
  savePushSubscription,
  setReminderPref,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";

type Prefs = { remindWeighIn: boolean; remindLog: boolean; remindComments: boolean };

const ROWS: { key: keyof Prefs; label: string; detail: string }[] = [
  { key: "remindWeighIn", label: "Morning weigh-in", detail: "8 am, only if you haven't weighed in." },
  { key: "remindLog", label: "Evening check", detail: "8 pm, only if nothing was logged today." },
  { key: "remindComments", label: "Coach comments", detail: "As soon as your coach replies." },
];

/** The browser's subscribe call wants the key as bytes, not base64url. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

type Support = "checking" | "ok" | "install" | "unsupported" | "blocked";

/**
 * Turns notifications on for this device, and picks which nudges arrive.
 *
 * On an iPhone, web notifications exist only for an app added to the Home
 * Screen, so Safari in a tab is told how to get there rather than shown a
 * button that cannot work.
 */
export function Reminders({ vapidKey, prefs }: { vapidKey: string; prefs: Prefs }) {
  const [support, setSupport] = React.useState<Support>("checking");
  const [subscribed, setSubscribed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [state, setState] = React.useState(prefs);

  React.useEffect(() => {
    const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!capable) {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      setSupport(ios ? "install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setSupport("blocked");
      return;
    }
    setSupport("ok");
    void registration()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "blocked" : "ok");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(vapidKey),
      });
      const res = await runAction(() => savePushSubscription(sub.toJSON()));
      if (!res.ok) {
        await sub.unsubscribe();
        toast.error(res.error);
        return;
      }
      setSubscribed(true);
      toast.success("Reminders are on for this device.");
    } catch {
      toast.error("This browser would not turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await runAction(() => removePushSubscription(sub.endpoint));
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Reminders are off for this device.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: keyof Prefs) {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    const res = await runAction(() => setReminderPref(key, next));
    if (!res.ok) {
      setState((s) => ({ ...s, [key]: !next }));
      toast.error(res.error);
    }
  }

  if (support === "checking") return null;

  if (support === "install") {
    return (
      <p className="text-[14px] leading-relaxed text-fg-muted">
        On iPhone, reminders work once Track Me is on your Home Screen: tap{" "}
        <span className="font-medium text-fg">Share</span>, then{" "}
        <span className="font-medium text-fg">Add to Home Screen</span>, and open it from there.
      </p>
    );
  }

  if (support === "unsupported") {
    return (
      <p className="text-[14px] leading-relaxed text-fg-muted">
        This browser can&apos;t show notifications. Try Chrome, Edge, Firefox or Safari.
      </p>
    );
  }

  if (support === "blocked") {
    return (
      <p className="text-[14px] leading-relaxed text-fg-muted">
        Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then
        come back here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {subscribed ? (
        <ul className="flex flex-col">
          {ROWS.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-fg">{row.label}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">{row.detail}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state[row.key]}
                aria-label={row.label}
                onClick={() => toggle(row.key)}
                className={cn(
                  "relative h-6 w-10 shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  state[row.key] ? "border-accent bg-accent" : "border-line-strong bg-surface-inset",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition-[left]",
                    state[row.key] ? "left-[20px]" : "left-[3px]",
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] leading-relaxed text-fg-muted">
          A nudge at 8 am to weigh in and at 8 pm if the day is still empty, plus a ping when your
          coach comments. Nothing else, and never if you&apos;ve already logged.
        </p>
      )}

      <div>
        {subscribed ? (
          <Button type="button" variant="outline" onClick={turnOff} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <BellOff />}
            Turn off on this device
          </Button>
        ) : (
          <Button type="button" onClick={turnOn} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Bell />}
            Turn on reminders
          </Button>
        )}
      </div>
    </div>
  );
}
