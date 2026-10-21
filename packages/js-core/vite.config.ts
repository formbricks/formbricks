/// <reference types="vitest" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import type { ViteUserConfig } from "vitest/config";
import { copyCompiledAssetsPlugin } from "../vite-plugins/copy-compiled-assets";
import { rewriteNodeNextDtsSpecifiers } from "../vite-plugins/node-next-dts";
import { UMD_WITHOUT_AMD_OUTPUT } from "../vite-plugins/umd-without-amd";

type VitestPluginOption = NonNullable<ViteUserConfig["plugins"]>[number];

// The debug panel is its own bundle, built in a second pass (`BUILD_DEBUG_PANEL=true`), so the SDK
// every visitor downloads carries none of it; the SDK injects it only under `?formbricksDebug=true`.
// The copy plugin renames `index-debug.js` to `apps/web/public/js/formbricks-debug.js`.
const isDebugPanelBuild = process.env.BUILD_DEBUG_PANEL === "true";

const copyToWebApp = copyCompiledAssetsPlugin({
  filename: "formbricks",
  distDir: resolve(__dirname, "dist"),
  skipDirectoryCheck: true, // Skip checking for subdirectories that might not exist
}) as VitestPluginOption;

const debugPanelBuild = {
  emptyOutDir: false,
  lib: {
    entry: resolve(__dirname, "src/debug-panel/index.ts"),
    name: "formbricksDebugPanel",
    formats: ["iife" as const],
    fileName: () => "index-debug.js",
  },
};

const sdkBuild = {
  rollupOptions: {
    output: { inlineDynamicImports: true, ...UMD_WITHOUT_AMD_OUTPUT },
  },
  emptyOutDir: false, // keep the dist folder to avoid errors with pnpm go when folder is empty during build
  lib: {
    entry: resolve(__dirname, "src/index.ts"),
    name: "formbricks",
    formats: ["umd" as const],
    fileName: "index",
  },
};

/**
 * The survey renderer js-core loads, as @formbricks/surveys builds it; served as `/js/surveys.umd.cjs`.
 * turbo.json edges `@formbricks/js-core#build` to `@formbricks/surveys#build`, so the renderer is built
 * first and any renderer change also invalidates this build — that edge is what carries the hash.
 */
const SURVEY_RENDERER_PATH = resolve(__dirname, "../surveys/dist/index.umd.cjs");

/**
 * Content hash of the survey renderer, injected as `__FB_SURVEY_RENDERER_HASH__` and appended to its URL
 * as `?v=`, like `__FB_LOCALES_HASH__` in packages/surveys/vite.config.mts. `/js/*` is served with a
 * 30-day `s-maxage`, so without it a new SDK could run a month-old cached renderer.
 *
 * A production build without the renderer fails rather than ship an unversioned URL.
 */
const computeSurveyRendererHash = (): string => {
  let renderer: Buffer;
  try {
    renderer = readFileSync(SURVEY_RENDERER_PATH);
  } catch (error) {
    throw new Error(
      `The survey renderer ${SURVEY_RENDERER_PATH} is missing, so its hash cannot be inlined. ` +
        "Build through Turbo (`pnpm build --filter=@formbricks/js-core`), which builds it first.",
      { cause: error }
    );
  }
  return createHash("sha256").update(renderer).digest("hex").slice(0, 12);
};

export default defineConfig(({ command, mode }) => ({
  // Production builds only: dev builds and tests fall back to `?v=dev` (see `getSurveysScriptUrl`).
  define:
    command === "build" && mode === "production"
      ? { __FB_SURVEY_RENDERER_HASH__: JSON.stringify(computeSurveyRendererHash()) }
      : {},
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: isDebugPanelBuild ? debugPanelBuild : sdkBuild,
  plugins: isDebugPanelBuild
    ? [copyToWebApp]
    : [
        dts({
          rollupTypes: false,
          insertTypesEntry: true,
          include: ["src/**/*.ts"],
          exclude: [
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/tests/**",
            "src/debug-panel/**",
            "vitest.setup.ts",
          ],
          beforeWriteFile: rewriteNodeNextDtsSpecifiers,
        }) as VitestPluginOption,
        copyToWebApp,
      ],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/debug-panel/format.ts"],
      exclude: ["src/lib/**/*.mock.ts", "vitest.setup.ts", "**/*.test.*", "**/*.spec.*"],
    },
  },
}));
