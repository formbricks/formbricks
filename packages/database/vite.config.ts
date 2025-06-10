import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "src/index.ts"),
        "types/survey-follow-up": resolve(__dirname, "types/survey-follow-up.ts"),
        "scripts/apply-migrations": resolve(__dirname, "src/scripts/apply-migrations.ts"),
        "scripts/create-saml-database": resolve(__dirname, "src/scripts/create-saml-database.ts"),
        "scripts/migration-runner": resolve(__dirname, "src/scripts/migration-runner.ts"),
        "scripts/generate-data-migration": resolve(__dirname, "src/scripts/generate-data-migration.ts"),
        "scripts/create-migration": resolve(__dirname, "src/scripts/create-migration.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        format: "cjs", // Use CommonJS for Node.js runtime
        interop: "compat", // Better compatibility with mixed modules
        exports: "auto", // Auto-detect export style
      },
      external: [
        // External dependencies that should not be bundled
        "@prisma/client",
        "@formbricks/logger",
        "zod",
        "zod-openapi",
        "@paralleldrive/cuid2",
      ],
    },
    emptyOutDir: true,
    target: "node18",
    ssr: true, // Server-side rendering mode for Node.js
  },
  plugins: [
    dts({
      rollupTypes: true,
      include: ["src/**/*", "types/**/*"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    }),
  ],
});
