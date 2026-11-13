import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  reporter: "list",
  use: { baseURL: "http://localhost:1401" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // `npm run build` must have run first: serve.mjs starts the production server on a seeded e2e database.
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:1401",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
