import { promises as fs } from "fs";
import { glob } from "glob";
import { dirname, resolve } from "path";
import { Plugin, UserConfig, defineConfig } from "vite";
import dts from "vite-plugin-dts";

const copySqlMigrationsPlugin: Plugin = {
  name: "copy-sql-migrations",
  async writeBundle() {
    const sqlFiles = await glob("migration/**/migration.sql", { cwd: __dirname });

    await Promise.all(
      sqlFiles.map(async (file) => {
        const srcPath = resolve(__dirname, file);
        const destPath = resolve(__dirname, "dist", file);
        await fs.mkdir(dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      })
    );
  },
};

export default defineConfig(async (): Promise<UserConfig> => {
  const migrationTsFiles = [];
  for await (const file of fs.glob("migration/**/migration.ts", { cwd: __dirname })) {
    migrationTsFiles.push(file);
  }
  const migrationEntries = migrationTsFiles.reduce((acc: Record<string, string>, file: string) => {
    const dir = dirname(file);
    const entryName = `${dir}/migration`;
    acc[entryName] = resolve(__dirname, file);
    return acc;
  }, {});

  return {
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
      ssr: true, // Server-side rendering mode for Node.js
    },
    plugins: [
      dts({
        rollupTypes: false,
        include: ["src/**/*"],
        exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
        insertTypesEntry: true,
      }),
      copySqlMigrationsPlugin,
    ],
  };
});
