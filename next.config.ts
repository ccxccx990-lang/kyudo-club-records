import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "playwright", "playwright-core"],
  /** Vercel: PLAYWRIGHT_BROWSERS_PATH=0 で入った Chromium を PDF API の関数バンドルに含める */
  outputFileTracingIncludes: {
    "/api/reports/personal-hit-rate/pdf": [
      "./node_modules/playwright-core/.local-browsers/**/*",
    ],
  },
};

export default nextConfig;
