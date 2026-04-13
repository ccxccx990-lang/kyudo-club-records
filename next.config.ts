import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "puppeteer-core", "@sparticuz/chromium"],
  /** Vercel: @sparticuz/chromium の brotli バイナリを PDF API に同梱 */
  outputFileTracingIncludes: {
    "/api/reports/personal-hit-rate/pdf": ["./node_modules/@sparticuz/chromium/**/*"],
  },
};

export default nextConfig;
