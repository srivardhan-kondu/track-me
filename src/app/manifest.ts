import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Track Me",
    short_name: "Track Me",
    description:
      "Log meals, workouts and weight by voice. Your coach sees everything in one timeline.",
    start_url: "/dashboard",
    // Land on the timeline, but keep the whole app in scope so navigation
    // stays inside the installed window rather than bouncing to the browser.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#221f1c",
    theme_color: "#e0a355",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Log a meal", url: "/dashboard?log=meal" },
      { name: "Log a workout", url: "/dashboard?log=workout" },
      { name: "Weigh in", url: "/dashboard?log=weight" },
    ],
  };
}
