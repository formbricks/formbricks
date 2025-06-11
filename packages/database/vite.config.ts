import { copyFileSync, globSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const migrationTsFiles = globSync("migration/**/migration.ts", { cwd: __dirname });
const migrationEntries = migrationTsFiles.reduce(
  (acc, file) => {
    const dir = dirname(file);
    const entryName = `${dir}/migration`;
    acc[entryName] = resolve(__dirname, file);
    return acc;
  },
  {} as unknown as Record<string, string>
);

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
        ...migrationEntries,
      },
      output: {
        format: "esm",
      },
      external: [
        // External dependencies that should not be bundled
        "@prisma/client",
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
      rollupTypes: false,
      include: ["src/**/*"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
      insertTypesEntry: true,
    }),
    {
      name: "copy-sql-migrations",
      writeBundle() {
        const sqlFiles = globSync("migration/**/migration.sql", { cwd: __dirname });
        sqlFiles.forEach((file) => {
          const srcPath = resolve(__dirname, file);
          const destPath = resolve(__dirname, "dist", file);
          mkdirSync(dirname(destPath), { recursive: true });
          copyFileSync(srcPath, destPath);
        });
      },
    },
  ],
});
