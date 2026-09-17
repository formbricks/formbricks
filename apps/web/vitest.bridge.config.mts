import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Disposable Cloud bridge only: real PostgreSQL, no shared unit-test database mocks or developer .env.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: [
      "lib/authorization/bridge-postgres.integration.test.ts",
      "modules/ee/analysis/charts/lib/bridge-chart.integration.test.ts",
    ],
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
