import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ResolvedConfig } from "vite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { copyCompiledAssetsPlugin } from "./index";

// The plugin's contract is a build side effect (files appearing under
// apps/web/public/js), so nothing else in the test suites exercises it.
// These tests pin both halves of that contract: existing consumers
// (js-core, surveys) keep writing to the js root when `outputSubDir` is
// omitted, and consumers that pass it (mobile-core) write only to the
// subdirectory.

const runPlugin = async (
  root: string,
  options: Parameters<typeof copyCompiledAssetsPlugin>[0]
): Promise<void> => {
  const plugin = copyCompiledAssetsPlugin(options);
  const configResolved = plugin.configResolved as unknown as (config: ResolvedConfig) => void;
  const writeBundle = plugin.writeBundle as unknown as () => Promise<void>;
  configResolved({ root } as ResolvedConfig);
  await writeBundle();
};

describe("copyCompiledAssetsPlugin", () => {
  let tmp: string;
  let packageRoot: string;
  let jsRoot: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), "copy-compiled-assets-"));
    // Mirrors the monorepo shape the plugin assumes: <root>/packages/<pkg>
    // resolving "../../apps/web/public/js" relative to the package root.
    packageRoot = path.join(tmp, "packages", "fake-package");
    jsRoot = path.join(tmp, "apps", "web", "public", "js");
    await mkdir(path.join(packageRoot, "dist"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  test("without outputSubDir, copies into the js root and renames index to the filename", async () => {
    await writeFile(path.join(packageRoot, "dist", "index.umd.cjs"), "umd-bundle");
    await writeFile(path.join(packageRoot, "dist", "index.js"), "esm-bundle");

    await runPlugin(packageRoot, { filename: "formbricks", distDir: "dist" });

    await expect(readFile(path.join(jsRoot, "formbricks.umd.cjs"), "utf8")).resolves.toBe("umd-bundle");
    await expect(readFile(path.join(jsRoot, "formbricks.js"), "utf8")).resolves.toBe("esm-bundle");
  });

  test("with outputSubDir, copies only into the subdirectory", async () => {
    await writeFile(path.join(packageRoot, "dist", "core.umd.cjs"), "brain-bundle");

    await runPlugin(packageRoot, { filename: "core", distDir: "dist", outputSubDir: "mobile/v1" });

    await expect(readFile(path.join(jsRoot, "mobile", "v1", "core.umd.cjs"), "utf8")).resolves.toBe(
      "brain-bundle"
    );
    // The js root must not receive a stray copy alongside the subdirectory one.
    await expect(readdir(jsRoot)).resolves.toEqual(["mobile"]);
  });
});
