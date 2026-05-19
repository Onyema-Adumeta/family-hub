import { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.familyhub.app",
  appName: "Family Hub",
  webDir: "dist",
  server: { url: "https://family-hub-web-omega.vercel.app", cleartext: true },
  android: { allowMixedContent: true }
};
export default config;
