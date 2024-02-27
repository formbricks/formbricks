import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitestSetup.ts"],
  },
});
