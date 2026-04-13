import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "playwright", "playwright-core"],
};

export default nextConfig;
