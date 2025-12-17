/// <reference types="vitest" />
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

/**
 * Plugin to strip "use client" directives from bundled dependencies.
 *
 * This fixes warnings from Radix UI and other packages that include "use client"
 * directives for Next.js React Server Components compatibility. When Vite bundles
 * these packages, it emits warnings because module-level directives aren't supported
 * in the bundled output.
 *
 * The "use client" directive is only relevant for Next.js RSC and doesn't affect
 * our library build, so it's safe to remove during bundling.
 *
 * Related issue: https://github.com/TanStack/query/issues/5175
 */
export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        /^@formkit\/auto-animate/,
        /^@radix-ui/,
        "class-variance-authority",
        "clsx",
        /^date-fns/,
        "isomorphic-dompurify",
        "lucide-react",
        /^react-day-picker/,
        "tailwind-merge",
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: [
    tsconfigPaths(),
    dts({ include: ["src"] }),
    tailwindcss(),
  ],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.stories.tsx"],
    },
  },
});

