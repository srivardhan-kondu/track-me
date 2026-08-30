import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "openai"],
  experimental: {
    serverActions: {
      // Progress photos and meal images are uploaded through server actions.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
