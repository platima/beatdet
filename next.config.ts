import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Cloudflare Pages (no Node.js server runtime).
  output: "export",
};

export default nextConfig;
