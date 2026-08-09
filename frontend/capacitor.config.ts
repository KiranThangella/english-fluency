import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.englishfluency.app", // change to your own reverse-domain ID before publishing
  appName: "English Fluency Trail",
  webDir: "dist",
  // Speech recognition, mic access, etc. need HTTPS-equivalent context —
  // Capacitor serves the bundled app over its own local scheme by default,
  // which satisfies that. No server.url override needed for a bundled app.
};

export default config;
