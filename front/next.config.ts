/******************************** next.config.ts ***************************************
 *
 *  Module: Next.Config
 *
 *  This module configures the Next.js and Capacitor frontend application.
 *
 *  The module provides:
 *
 *  - tooling or runtime configuration for the frontend.
 *  - settings consumed by build, lint, or mobile sync commands.
 *
 *  Key Structures Used:
 *
 *  - configuration objects, plugin settings, or shared declarations.
 *
 *  This module ensures:
 *
 *  - frontend tooling reads settings from one checked-in location.
 *  - local and deployment builds use the same defaults.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: configDir,
  },
  // Removed output: "export" — NextAuth requires a running server
};

export default nextConfig;
