/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvConfig(repoRoot);

const nextConfig = {
  transpilePackages: ["@saasclinics/lib"],
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.in",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "greencoatvets.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.greencoatvets.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      "/api/reception/walk-in-qr": [
        "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
        "../../node_modules/@fontsource/inter/files/inter-latin-800-normal.woff",
      ],
    },
  },
};

export default nextConfig;
