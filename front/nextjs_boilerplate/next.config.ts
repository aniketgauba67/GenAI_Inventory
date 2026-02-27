import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/GenAI_Inventory",
  assetPrefix: "/GenAI_Inventory/",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
