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
      include: ["app/**/*.{ts,tsx}", "modules/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/.next/**", // Next.js build output
        "**/*.spec.*", // Test files
        "**/*.test.*", // Test files
        "**/*.mock.*", // Mock files
        "**/mocks/**", // Mock directories
        "**/__mocks__/**", // Jest-style mock directories
        "**/constants.ts", // Constants files
        "**/route.ts", // Next.js API routes
        "**/openapi.ts", // OpenAPI spec files
        "**/openapi-document.ts", // OpenAPI-related document files
        "**/types/**", // Type definition folders
        "**/types.ts", // Files named 'types.ts'
        "**/actions.ts", // Server actions (plural)
        "**/action.ts", // Server actions (singular)
        "**/stories.*", // Storybook files (e.g., .stories.tsx)
        "**/*.config.{js,ts,mjs,mts,cjs}", // All configuration files
        "**/middleware.ts", // Next.js middleware
        "**/instrumentation.ts", // Next.js instrumentation files
        "**/instrumentation-node.ts", // Next.js Node.js instrumentation files
        "**/vitestSetup.ts", // Vitest setup files
        "**/*.json", // JSON files
        "**/*.mdx", // MDX files
        "**/playwright/**", // Playwright E2E test files
        "**/Dockerfile", // Dockerfiles
        "**/*.css", // CSS files
        "**/templates.ts", // Project-specific template files
        "**/*.setup.*", // Setup files
        "**/scripts/**", // Utility scripts
        "modules/ui/components/icons/*",
        "**/cache.ts", // Exclude cache files
        "packages/surveys/src/components/general/smileys.tsx",
        "modules/auth/lib/mock-data.ts", // Exclude mock data files
        "modules/analysis/components/SingleResponseCard/components/Smileys.tsx",
        "**/*.mjs",
        "app/**/billing-confirmation/**",
        "modules/ee/billing/**",
        "modules/ee/multi-language-surveys/**",
        "modules/email/**",
        "modules/integrations/**",
        "modules/setup/**/intro/**",
        "modules/setup/**/signup/**",
        "modules/setup/**/layout.tsx",
        "modules/survey/follow-ups/**",
        "app/share/**",
        "lib/shortUrl/**",
        "modules/ee/contacts/[contactId]/**",
        "modules/ee/contacts/components/**",
        "modules/ee/two-factor-auth/**",
        "lib/posthogServer.ts",
        "lib/slack/**",
        "lib/notion/**",
        "lib/googleSheet/**",
        "app/api/google-sheet/**",
        "app/api/billing/**",
        "lib/airtable/**",
        "app/api/v1/integrations/**",
        "lib/env.ts",
      ],
    },
  },
  plugins: [tsconfigPaths(), react() as PluginOption],
});