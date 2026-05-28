import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dtqajfxkhfarwqzuuepn.supabase.co",
      },
    ],
  },
};

export default nextConfig;
