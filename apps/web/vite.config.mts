// vitest.config.ts
import react from "@vitejs/plugin-react";
import { PluginOption, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests run only via `pnpm test:integration` (vitest.integration.config.mts) against a
    // real Postgres + Redis; the unit config mocks the DB, so they must be excluded here (ENG-1054).
    exclude: ["playwright/**", "node_modules/**", ".next/**", "**/*.integration.test.ts"],
    setupFiles: ["./vitestSetup.ts"],
    env: loadEnv("", process.cwd(), ""),
    // Environment selection (ENG-1680): Vitest 4 removed `environmentMatchGlobs`, so environments
    // are assigned via projects. *.test.ts run in node; *.test.tsx (component tests) run in jsdom
    // automatically - no `@vitest-environment` pragma needed.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          exclude: [
            "playwright/**",
            "node_modules/**",
            ".next/**",
            "**/*.integration.test.ts",
            "**/*.test.tsx",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
        },
      },
    ],
    coverage: {
      provider: "v8", // Use V8 as the coverage provider
      reporter: ["text", "html", "lcov"], // Generate text summary and HTML reports
      reportsDirectory: "./coverage", // Output coverage reports to the coverage/ directory
      include: [
        "app/**/*.ts",
        "modules/**/*.ts",
        "lib/**/*.ts",
        "lingodotdev/**/*.ts",
        "instrumentation-jobs.ts",
        "proxy.ts",
      ],
      exclude: [
        // Build and configuration files
        "**/.next/**", // Next.js build output
        "**/*.config.{js,ts,mjs,mts,cjs}", // All configuration files
        "**/Dockerfile", // Dockerfiles
        "**/vitestSetup.ts", // Vitest setup files
        "**/*.setup.*", // Setup files

        // Test and mock related files
        "**/*.spec.*", // Test files
        "**/*.test.*", // Test files
        "**/*.mock.*", // Mock files
        "**/mocks/**", // Mock directories
        "**/__mocks__/**", // Jest-style mock directories
        "**/playwright/**", // Playwright E2E test files

        // TSX files (covered by E2E tests)
        "**/*.tsx", // All TSX/React component files

        // Next.js specific files
        "**/route.{ts,tsx}", // Next.js API routes
        "**/middleware.ts", // Next.js middleware
        "**/instrumentation.ts", // Next.js instrumentation files
        "**/instrumentation-node.ts", // Next.js Node.js instrumentation files

        // Documentation and static files
        "**/openapi.ts", // OpenAPI spec files
        "**/openapi-document.ts", // OpenAPI-related document files
        "**/*.json", // JSON files
        "**/*.mdx", // MDX files
        "**/*.css", // CSS files

        // Type definitions and constants
        "**/types/**", // Type definition folders
        "**/types.ts", // Files named 'types.ts'
        "**/constants.ts", // Constants files

        // Server-side code
        "**/actions.ts", // Server actions (plural)
        "**/action.ts", // Server actions (singular)
        "lib/env.ts", // Environment configuration
        "**/cache.ts", // Cache files
        "**/cache/**", // Cache directories

        // UI Components and Templates
        "**/stories.*", // Storybook files
        "**/templates.ts", // Workspace-specific template files
        "modules/ui/components/icons/*", // Icon components
        "modules/ui/components/icons/**", // Icon components (nested)

        // Feature-specific modules
        "app/**/billing-confirmation/**", // Billing confirmation pages
        "modules/ee/billing/**", // Enterprise billing features
        "modules/survey/multi-language-surveys/**", // Multi-language survey features
        "modules/email/**", // Email functionality
        "modules/integrations/**", // Integration modules
        "modules/setup/**/intro/**", // Setup intro pages
        "modules/setup/**/signup/**", // Setup signup pages
        "modules/setup/**/layout.tsx", // Setup layouts
        "modules/ee/contacts/components/**", // Contact components

        // Third-party integrations
        "lib/slack/**", // Slack integration
        "lib/notion/**", // Notion integration
        "lib/googleSheet/**", // Google Sheets integration
        "app/api/google-sheet/**", // Google Sheets API
        "app/api/billing/**", // Billing API
        "lib/airtable/**", // Airtable integration
        "app/api/v1/integrations/**", // Integration APIs

        // Specific components
        "modules/auth/lib/mock-data.ts", // Mock data for authentication
        // Better Auth instance + wiring — exercised by the integration suite (real Postgres), not unit
        // tests, so they are excluded from the unit-coverage gate below (ENG-1054).
        "modules/auth/lib/auth.ts",
        "modules/auth/lib/auth-client.ts",
        "modules/auth/lib/secondary-storage.ts",
        "modules/auth/lib/better-auth-email-verification.ts",
        "packages/js-core/src/index.ts", // JS Core index file

        // Other
        "**/scripts/**", // Utility scripts
        "modules/auth/lib/cutover/**", // One-time ENG-1054 cutover migration scripts (run once, not app runtime)
        "**/*.mjs", // ES modules
      ],
      thresholds: {
        // ENG-1054: keep the new Better Auth code well-tested. Glob aggregate (not perFile) so a single
        // thin file can't trip the gate; the integration-only BA instance/wiring is excluded above.
        "modules/auth/lib/**": { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
  },
  plugins: [tsconfigPaths(), react() as PluginOption],
});
