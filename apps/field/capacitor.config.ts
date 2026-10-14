import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.evflow.app",
  appName: "evflow",
  webDir: ".output/public",
  server: { androidScheme: "https" },
};

export default config;
