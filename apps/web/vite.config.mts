// vitest.config.ts
import react from "@vitejs/plugin-react";
import { PluginOption, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    exclude: ["playwright/**", "node_modules/**"],
    setupFiles: ["./vitestSetup.ts"],
    env: loadEnv("", process.cwd(), ""),
    coverage: {
      provider: "v8", // Use V8 as the coverage provider
      reporter: ["text", "html", "lcov"], // Generate text summary and HTML reports
      reportsDirectory: "./coverage", // Output coverage reports to the coverage/ directory
      include: [
        "app/**/*.{ts,tsx}",
        "modules/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/.next/**",
        "**/*.spec.*",
        "**/constants.ts", // Exclude constants files
        "**/route.ts", // Exclude route files
        "**/openapi.ts", // Exclude openapi configuration files
        "**/openapi-document.ts", // Exclude openapi document files
        "**/types/**", // Exclude types
        "modules/**/types/**", // Exclude types
        "**/actions.ts", // Exclude action files
        "**/stories.tsx", // Exclude story files
        "**/*.config.{js,ts,mjs,mts}", // Exclude various config files
        "**/middleware.ts", // Exclude middleware files
        "**/instrumentation.ts", // Exclude instrumentation files
        "**/instrumentation-node.ts", // Exclude node instrumentation files
        "**/vitestSetup.ts" // Exclude vitest setup file
      ],
    },
  },
  plugins: [tsconfigPaths(), react() as PluginOption],
});
