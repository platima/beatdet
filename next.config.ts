import type { NextConfig } from "next";
import fs from "fs";

// Read the version from the VERSION file at build time so all components
// can access it via process.env.NEXT_PUBLIC_APP_VERSION without hardcoding.
const appVersion = fs.readFileSync("./VERSION", "utf8").trim();

const nextConfig: NextConfig = {
  // Static export for Cloudflare Pages (no Node.js server runtime).
  output: "export",
  // Make the version available to client components as a compile-time constant.
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
