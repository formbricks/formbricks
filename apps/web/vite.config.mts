import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["playwright/**", "node_modules/**"],
    setupFiles: ["../../packages/lib/vitestSetup.ts"],
  },
  plugins: [tsconfigPaths()],
});
