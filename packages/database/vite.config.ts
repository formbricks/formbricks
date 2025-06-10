import { resolve } from "path";
import { defineConfig } from "vite";

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
        "scripts/apply-migrations": resolve(__dirname, "src/scripts/apply-migrations.ts"),
        "scripts/create-saml-database": resolve(__dirname, "src/scripts/create-saml-database.ts"),
        "scripts/migration-runner": resolve(__dirname, "src/scripts/migration-runner.ts"),
        "scripts/generate-data-migration": resolve(__dirname, "src/scripts/generate-data-migration.ts"),
        "scripts/create-migration": resolve(__dirname, "src/scripts/create-migration.ts"),
      },
      output: {
        format: "esm",
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
});
