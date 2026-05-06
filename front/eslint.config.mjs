/******************************** eslint.config.mjs ***************************************
 *
 *  Module: Eslint.Config
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
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "android/.gradle/**",
    "android/build/**",
    "android/**/build/**",
    "jest.config.js",
    "next-env.d.ts",
    "**/* 2.*",
    "**/* 3.*",
  ]),
]);

export default eslintConfig;
