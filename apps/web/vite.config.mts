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
        "modules/api/v2/**/*.ts",
        "modules/api/v2/**/*.tsx",
        "modules/auth/lib/**/*.ts",
        "modules/auth/signup/components/signup-form.tsx",
        "modules/auth/signup/page.tsx",
        "modules/signup/lib/**/*.ts",
        "modules/auth/signup/lib/**/*.ts",
        "modules/auth/signup/**/*.tsx",
        "modules/ee/whitelabel/email-customization/components/*.tsx",
        "modules/ee/sso/lib/**/*.ts",
        "modules/email/components/email-template.tsx",
        "modules/email/emails/survey/follow-up.tsx",
        "modules/email/emails/lib/*.tsx",
        "modules/environments/lib/**/*.ts",
        "modules/ui/components/post-hog-client/*.tsx",
        "modules/ee/role-management/components/*.tsx",
        "modules/ee/role-management/actions.ts",
        "modules/organization/settings/teams/components/edit-memberships/organization-actions.tsx",
        "modules/ui/components/alert/*.tsx",
        "modules/ui/components/environmentId-base-layout/*.tsx",
        "modules/ui/components/survey/recaptcha.ts",
        "modules/ui/components/progress-bar/index.tsx",
        "app/(app)/(onboarding)/organizations/**/layout.tsx",
        "app/(app)/(survey-editor)/environments/**/layout.tsx",
        "app/(auth)/layout.tsx",
        "app/(app)/layout.tsx",
        "app/layout.tsx",
        "app/api/v2/client/**/responses/lib/utils.ts",
        "app/intercom/*.tsx",
        "app/sentry/*.tsx",
        "modules/ee/sso/lib/**/*.ts",
        "modules/ee/sso/lib/organization.ts",
        "app/lib/**/*.ts",
        "modules/ee/license-check/lib/utils.ts",
        "modules/ee/role-management/*.ts",
        "modules/organization/settings/teams/actions.ts",
        "modules/organization/settings/api-keys/lib/**/*.ts",
        "app/api/**/*.ts",
        "modules/api/v2/management/auth/*.ts",
        "modules/organization/settings/api-keys/components/*.tsx",
        "modules/survey/hooks/*.tsx",
        "modules/survey/components/question-form-input/index.tsx",
        "modules/survey/components/template-list/components/template-tags.tsx",
        "modules/survey/lib/client-utils.ts",
        "modules/survey/components/edit-public-survey-alert-dialog/index.tsx",
        "modules/survey/list/lib/project.ts",
        "modules/survey/list/components/survey-card.tsx",
        "modules/survey/list/components/survey-dropdown-menu.tsx",
        "modules/auth/signup/**/*.ts",
        "modules/survey/follow-ups/components/follow-up-item.tsx",
        "modules/ee/contacts/segments/*",
        "modules/survey/editor/lib/utils.tsx",
        "modules/ee/contacts/api/v2/management/contacts/bulk/lib/contact.ts",
        "modules/ee/sso/components/**/*.tsx",
        "modules/ee/sso/lib/team.ts",
        "app/global-error.tsx",
        "app/error.tsx",
        "modules/survey/lib/permission.ts",
        "modules/account/**/*.tsx",
        "modules/account/**/*.ts",
        "modules/analysis/**/*.tsx",
        "modules/analysis/**/*.ts",
        "app/lib/survey-builder.ts",
        "lib/utils/billing.ts",
        "modules/survey/list/components/copy-survey-form.tsx",
        "lib/crypto.ts",
        "lib/surveyLogic/utils.ts",
        "lib/utils/billing.ts",
        "modules/ui/components/card/index.tsx",
        "modules/survey/editor/components/*.tsx",
        "lib/fileValidation.ts",
        "modules/survey/editor/components/add-action-modal.tsx",
        "modules/survey/editor/components/add-ending-card-button.tsx",
        "modules/survey/editor/components/add-question-button.tsx",
        "modules/survey/editor/components/advanced-settings.tsx",
        "modules/survey/editor/components/color-survey-bg.tsx",
        "modules/survey/editor/components/date-question-form.tsx",
        "modules/survey/editor/components/file-upload-question-form.tsx",
        "modules/survey/editor/components/how-to-send-card.tsx",
        "modules/survey/editor/components/image-survey-bg.tsx",
        "modules/ee/teams/**/*.ts",
        "modules/ee/teams/**/*.tsx",
        "app/(app)/environments/**/*.tsx",
        "app/(app)/environments/**/*.ts",
      ],
      exclude: [
        "**/.next/**",
        "**/*.spec.*", // Excludes .spec files from coverage
        "**/*.test.*", // Exclude .test files from coverage
        "**/constants.ts", // Exclude constants files
        "**/route.ts", // Exclude route files
        "**/openapi.ts", // Exclude openapi configuration files
        "**/openapi-document.ts", // Exclude openapi document files
        "**/actions.ts", // Exclude actions files
        "**/types/**", // Exclude types
        "**/types.ts", // Exclude types
        "**/actions.ts",
        "**/action.ts",
        "**/*.mock.*",
        "**/*.json",
        "**/*.test.*",
        "**/*.mdx",
        "**/*.config.mts",
        "**/*.config.ts",
        "**/stories.*",
        "**/mocks/**",
        "**/__mocks__/**",
        "**/instrumentation.ts",
        "**/playwright/**",
        "**/Dockerfile",
        "**/*.config.cjs",
        "**/*.css",
        "**/templates.ts",
        "apps/web/modules/ui/components/icons/*",
        "vitestSetup.ts", // Exclude Vitest setup file
        "tailwind.config.js", // Exclude Tailwind CSS config file
        "postcss.config.js", // Exclude PostCSS config file
        "next.config.mjs", // Exclude Next.js config file
        "scripts/**", // Exclude scripts folder (development scripts)
        "**/cache.ts", // Exclude cache files
        "packages/surveys/src/components/general/smileys.tsx",
        "apps/web/modules/auth/lib/mock-data.ts", // Exclude mock data files
        "apps/web/modules/analysis/components/SingleResponseCard/components/Smileys.tsx",
        "**/*.mjs"
      ],
    },
  },
  plugins: [tsconfigPaths(), react() as PluginOption],
});
