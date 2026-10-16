import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const canonicalSchema = readFileSync(new URL("../../authzed/schema.zed", import.meta.url), "utf8");

const migrationRoot = new URL("../../packages/database/migration/", import.meta.url);
const deferred = new Set([
  "20260928120000_eng_2404_backfill_remaining_embedded_data",
  "20260928120001_eng_2404_drop_survey_legacy_embedded_data_columns",
]);
const targetMigrations = readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !deferred.has(entry.name))
  .map(({ name }) => {
    const files = readdirSync(new URL(`${name}/`, migrationRoot));
    if (files.includes("migration.sql")) {
      const sql = readFileSync(new URL(`${name}/migration.sql`, migrationRoot), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }
    return { name };
  });

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    {
      name: "bundle-authzed-schema",
      generateBundle() {
        this.emitFile({ fileName: "schema.zed", source: canonicalSchema, type: "asset" });
        for (const name of ["source-migrations.json", "source-images.json", "schema-6.0.zed"]) {
          this.emitFile({
            fileName: name,
            source: readFileSync(new URL(`../../authzed/upgrade/${name}`, import.meta.url), "utf8"),
            type: "asset",
          });
        }
        this.emitFile({
          fileName: "target-migrations.json",
          source: JSON.stringify(targetMigrations),
          type: "asset",
        });
      },
    },
  ],
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./scripts/docker/server-only-empty.ts", import.meta.url)),
    },
  },
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    outDir: "dist/authzed-cli",
    ssr: "scripts/docker/authzed-cli.ts",
    target: "node24",
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].mjs",
        entryFileNames: "index.mjs",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
