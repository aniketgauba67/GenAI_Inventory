import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Removed output: "export" — NextAuth requires a running server
};

export default nextConfig;
