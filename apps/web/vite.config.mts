// vitest.config.ts
import { PluginOption, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    exclude: ["playwright/**", "node_modules/**"],
    setupFiles: ["../../packages/lib/vitestSetup.ts"],
    env: loadEnv("", process.cwd(), ""),
    coverage: {
      provider: "v8", // Use V8 as the coverage provider
      reporter: ["text", "html", "lcov"], // Generate text summary and HTML reports
      reportsDirectory: "./coverage", // Output coverage reports to the coverage/ directory
      include: [
        "modules/api/v2/**/*.ts",
        "modules/api/v2/**/*.tsx",
        "modules/auth/lib/**/*.ts",
        "modules/signup/lib/**/*.ts",
        "modules/auth/signup/lib/**/*.ts",
        "modules/auth/signup/**/*.tsx",
        "modules/ee/whitelabel/email-customization/components/*.tsx",
        "modules/email/components/email-template.tsx",
        "modules/email/emails/survey/follow-up.tsx",
        "modules/ui/components/post-hog-client/*.tsx",
        "modules/ee/role-management/components/*.tsx",
        "modules/organization/settings/teams/components/edit-memberships/organization-actions.tsx",
        "modules/ui/components/alert/*.tsx",
        "app/(app)/environments/**/layout.tsx",
        "app/(app)/environments/**/settings/(organization)/general/page.tsx",
        "app/(app)/environments/**/components/PosthogIdentify.tsx",
        "app/(app)/(onboarding)/organizations/**/layout.tsx",
        "app/(app)/(survey-editor)/environments/**/layout.tsx",
        "app/(auth)/layout.tsx",
        "app/(app)/layout.tsx",
        "app/layout.tsx",
        "app/intercom/*.tsx",
        "app/sentry/*.tsx",
        "app/(app)/environments/**/surveys/**/(analysis)/summary/components/SurveyAnalysisCTA.tsx",
        "modules/ee/sso/lib/**/*.ts",
        "app/lib/**/*.ts",
        "app/api/(internal)/insights/lib/**/*.ts",
        "modules/ee/role-management/*.ts",
        "modules/organization/settings/teams/actions.ts",
        "modules/organization/settings/api-keys/lib/**/*.ts",
        "app/api/v1/**/*.ts",
        "modules/api/v2/management/auth/*.ts",
        "modules/organization/settings/api-keys/components/*.tsx",
        "modules/survey/hooks/*.tsx",
        "modules/survey/lib/client-utils.ts",
        "modules/survey/list/components/survey-card.tsx",
        "modules/survey/list/components/survey-dropdown-menu.tsx",
        "modules/ee/contacts/segments/lib/**/*.ts",
        "modules/ee/contacts/api/v2/management/contacts/bulk/lib/contact.ts",
        "modules/ee/sso/components/**/*.tsx",
      ],
      exclude: [
        "**/.next/**",
        "**/*.spec.*",
        "**/constants.ts", // Exclude constants files
        "**/route.ts", // Exclude route files
        "**/openapi.ts", // Exclude openapi configuration files
        "**/openapi-document.ts", // Exclude openapi document files
        "modules/**/types/**", // Exclude types
      ],
    },
  },
  plugins: [tsconfigPaths(), react() as PluginOption],
});
