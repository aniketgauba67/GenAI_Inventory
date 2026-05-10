/******************************** capacitor.config.ts ***************************************
 *
 *  Module: Capacitor.Config
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
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? "https://www.inventorymanagement.dev";

const config: CapacitorConfig = {
  appId: "com.geninventory.app",
  appName: "GenAI Inventory",
  webDir: "out",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  ios: {},
  plugins: {
    Camera: {
      presentationStyle: "fullscreen",
    },
    Keyboard: {
      resize: "body",
      style: "default",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
