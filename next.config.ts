import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "openai"],
  experimental: {
    /*
      Keeps a visited page in the client router cache for 30s, so hopping
      between tabs and pressing Back is instant instead of a fresh server render
      every time. Any server action that calls revalidatePath empties this
      cache, so logging something never shows a stale screen.
    */
    staleTimes: { dynamic: 30, static: 180 },
    serverActions: {
      // Media is uploaded through server actions. Kept under the 4.5 MB
      // request-body cap that serverless platforms (Vercel) enforce; the
      // client downscales images before they get here.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
