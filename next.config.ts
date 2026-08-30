import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "openai"],
  experimental: {
    serverActions: {
      // Media is uploaded through server actions. Kept under the 4.5 MB
      // request-body cap that serverless platforms (Vercel) enforce; the
      // client downscales images before they get here.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
