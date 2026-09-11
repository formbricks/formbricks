import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const canonicalSchema = readFileSync(new URL("../../authzed/schema.zed", import.meta.url), "utf8");
const runtimeContractValue: unknown = JSON.parse(
  readFileSync(new URL("../../authzed/runtime-contract.json", import.meta.url), "utf8")
);
const releaseMode = process.env.FORMBRICKS_AUTHZED_RELEASE_MODE ?? "spicedb_authoritative";

if (releaseMode !== "legacy_bridge" && releaseMode !== "spicedb_authoritative") {
  throw new Error("FORMBRICKS_AUTHZED_RELEASE_MODE must be legacy_bridge or spicedb_authoritative");
}

if (
  typeof runtimeContractValue !== "object" ||
  runtimeContractValue === null ||
  !("clientContractVersion" in runtimeContractValue) ||
  typeof runtimeContractValue.clientContractVersion !== "number" ||
  !Number.isSafeInteger(runtimeContractValue.clientContractVersion) ||
  !("migrationHead" in runtimeContractValue) ||
  typeof runtimeContractValue.migrationHead !== "string" ||
  !("protocolVersion" in runtimeContractValue) ||
  typeof runtimeContractValue.protocolVersion !== "number" ||
  !Number.isSafeInteger(runtimeContractValue.protocolVersion)
) {
  throw new Error("authzed/runtime-contract.json is invalid");
}

const releaseManifest = JSON.stringify({
  authorizationMode: releaseMode,
  clientContractVersion: runtimeContractValue.clientContractVersion,
  migrationHead: runtimeContractValue.migrationHead,
  protocolVersion: runtimeContractValue.protocolVersion,
  sourceRevision: process.env.FORMBRICKS_BUILD_REVISION ?? process.env.GITHUB_SHA ?? "development",
});

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    {
      name: "bundle-authzed-schema",
      generateBundle() {
        this.emitFile({ fileName: "schema.zed", source: canonicalSchema, type: "asset" });
        this.emitFile({ fileName: "release-manifest.json", source: releaseManifest, type: "asset" });
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
