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
