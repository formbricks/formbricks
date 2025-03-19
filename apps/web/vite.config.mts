// vitest.config.ts
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["**/page.test.tsx", "node"], // page files use node environment because it uses server-side rendering
      ["**/*.test.tsx", "jsdom"],
    ],
    exclude: ["playwright/**", "node_modules/**"],
    setupFiles: ["../../packages/lib/vitestSetup.ts"],
    env: loadEnv("", process.cwd(), ""),
    coverage: {
      provider: "v8", // Use V8 as the coverage provider
      reporter: ["text", "html", "lcov"], // Generate text summary and HTML reports
      reportsDirectory: "./coverage", // Output coverage reports to the coverage/ directory
      include: [
        "modules/api/v2/**/*.ts",
        "modules/auth/lib/**/*.ts",
        "modules/signup/lib/**/*.ts",
        "modules/ee/whitelabel/email-customization/components/*.tsx",
        "modules/email/components/email-template.tsx",
        "modules/email/emails/survey/follow-up.tsx",
        "app/(app)/environments/**/settings/(organization)/general/page.tsx",
        "modules/ee/sso/lib/**/*.ts",
        "modules/ee/contacts/lib/**/*.ts",
        "modules/survey/link/lib/**/*.ts",
        "app/(auth)/layout.tsx",
        "app/(app)/layout.tsx",
        "app/intercom/*.tsx",
      ],
      exclude: [
        "**/.next/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/constants.ts", // Exclude constants files
        "**/route.ts", // Exclude route files
        "**/openapi.ts", // Exclude openapi configuration files
        "**/openapi-document.ts", // Exclude openapi document files
        "modules/**/types/**", // Exclude types
        "**/*.tsx", // Exclude tsx files
      ],
    },
  },
  plugins: [tsconfigPaths(), react()],
});
