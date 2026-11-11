import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * `pnpm test:e2e:local`: the suite against the dev server already on localhost:3000, from a machine
 * that has Playwright's full Chromium but not the headless shell or ffmpeg the default config needs.
 * Chromium projects only, no video, and the run stops at the first failure.
 */
export default defineConfig({
  ...base,
  maxFailures: 1,
  use: { ...base.use, video: "off" },
  projects: (base.projects ?? [])
    .filter((project) => project.name?.startsWith("chromium"))
    .map((project) => ({ ...project, use: { ...project.use, channel: "chromium" } })),
});
