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
        "lib/posthogServer.ts", // PostHog server integration
        "**/cache.ts", // Cache files
        "**/cache/**", // Cache directories

        // UI Components and Templates
        "**/stories.*", // Storybook files
        "**/templates.ts", // Project-specific template files
        "modules/ui/components/icons/*", // Icon components
        "modules/ui/components/icons/**", // Icon components (nested)

        // Feature-specific modules
        "app/**/billing-confirmation/**", // Billing confirmation pages
        "modules/ee/billing/**", // Enterprise billing features
        "modules/ee/multi-language-surveys/**", // Multi-language survey features
        "modules/email/**", // Email functionality
        "modules/integrations/**", // Integration modules
        "modules/setup/**/intro/**", // Setup intro pages
        "modules/setup/**/signup/**", // Setup signup pages
        "modules/setup/**/layout.tsx", // Setup layouts
        "app/share/**", // Share functionality
        "lib/shortUrl/**", // Short URL functionality
        "app/[shortUrlId]", // Short URL pages
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
        "packages/surveys/src/components/general/smileys.tsx", // Smiley components
        "modules/analysis/components/SingleResponseCard/components/Smileys.tsx", // Analysis smiley components
        "modules/auth/lib/mock-data.ts", // Mock data for authentication
        "packages/js-core/src/index.ts", // JS Core index file

        // Other
        "**/scripts/**", // Utility scripts
        "**/*.mjs", // ES modules
      ],
    },
  },
  plugins: [tsconfigPaths(), react() as PluginOption],
});
