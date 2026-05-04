import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  use: {
    baseURL: "http://localhost:80",
    trace: "on-first-retry",
    connectOptions: {
      wsEndpoint: "ws://localhost:3000",
    },
  },
});
