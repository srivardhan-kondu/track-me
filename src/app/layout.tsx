import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import { Providers } from "@/components/providers";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

import "./globals.css";

/*
  One family carries the whole interface: Manrope's variable axis covers the
  regular weight prose is set in and the extrabold cut the display figures use.
*/
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "Track Me",
    template: "%s · Track Me",
  },
  description:
    "AI-powered fitness reporting. Log meals, workouts and weight by voice — your coach sees everything in one timeline.",
  applicationName: "Track Me",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Track Me",
    // Content runs under the status bar, so the app fills the screen.
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Track Me is a dark-only app; the chrome matches the page's black.
  themeColor: "#0d0c14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Let the installed app paint into the notch and home-indicator areas.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={manrope.variable}>
      <body className="min-h-dvh bg-bg font-sans text-fg">
        <Providers>
          <RegisterServiceWorker />
          {children}
        </Providers>
      </body>
    </html>
  );
}
