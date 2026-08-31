import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <WifiOff className="mx-auto h-7 w-7 text-fg-faint" />
        <h1 className="mt-5 font-serif text-[26px] leading-none text-fg">
          You&apos;re offline
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">
          Track Me needs a connection to save a meal and estimate its macros.
          Your logs are safe — reconnect and this page will load again.
        </p>
      </div>
    </main>
  );
}
