import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <WifiOff className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Track Me needs a connection to save a meal and estimate its macros.
          Your logs are safe — reconnect and this page will load again.
        </p>
      </div>
    </main>
  );
}
