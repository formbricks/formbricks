import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitestSetup.ts"],
  },
  plugins: [tsconfigPaths()],
});
