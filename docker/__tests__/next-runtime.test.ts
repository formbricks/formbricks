import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { runtimeInventory } from "../../apps/web/scripts/docker/verify-next-runtime.mjs";

const verifier = fileURLToPath(
  new URL("../../apps/web/scripts/docker/verify-next-runtime.mjs", import.meta.url)
);
const directories: string[] = [];
const missingApolloFiles = ["11et9f1nxgprh.js", "3s3c6m9vr5bqy.js", "turbopack-3oxpdkit4b_pf.js"];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "next-runtime-"));
  directories.push(root);
  const write = (path: string, value: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  for (const file of ["package.json", "server.js", "online-server.js", "shutdown.js", "public/logo.svg"]) {
    write(`apps/web/${file}`, "{}");
  }
  write("apps/web/.next/BUILD_ID", "build-one");
  write(
    "apps/web/.next/required-server-files.json",
    JSON.stringify({ config: { deploymentId: "cloud-one" } })
  );
  write(
    "apps/web/.next/build-manifest.json",
    JSON.stringify({ rootMainFiles: missingApolloFiles.map((file) => `static/chunks/${file}`) })
  );
  for (const file of [...missingApolloFiles, "login.css"])
    write(`apps/web/.next/static/chunks/${file}`, "asset");
  write(
    "apps/web/.next/server/app/login_client-reference-manifest.js",
    'globalThis.manifest={css:["static/chunks/login.css"]}'
  );
  const seal = () =>
    write(
      "next-runtime.json",
      JSON.stringify({ version: 1, deploymentId: "cloud-one", variant: "ecr", files: runtimeInventory(root) })
    );
  seal();
  return { root, write, seal };
}

const verify = (root: string, id = "cloud-one", variant = "ecr") =>
  spawnSync(process.execPath, [verifier, root, id, variant], { encoding: "utf8" });

afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }))
);

describe("Next runtime artifact", () => {
  test("accepts a complete artifact, including a local build without a CI-supplied identity", () => {
    const { root } = fixture();
    expect(verify(root).status).toBe(0);
    expect(verify(root, "", "").status).toBe(0);
  });

  test.each(missingApolloFiles)(
    "rejects Apollo's missing bootstrap asset %s even with valid inventory hashes",
    (file) => {
      const { root, seal } = fixture();
      rmSync(join(root, "apps/web/.next/static/chunks", file));
      seal();
      const result = verify(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`Missing Next asset: static/chunks/${file}`);
    }
  );

  test("checks route-specific CSS beyond the root bootstrap", () => {
    const { root, seal } = fixture();
    rmSync(join(root, "apps/web/.next/static/chunks/login.css"));
    seal();
    expect(verify(root).stderr).toContain("Missing Next asset: static/chunks/login.css");
  });

  test("rejects a coherent but stale build or a different release variant", () => {
    const { root } = fixture();
    expect(verify(root, "cloud-two").status).toBe(1);
    expect(verify(root, "cloud-one", "ghcr").status).toBe(1);
  });

  test("rejects a mixed server configuration before serving any requests", () => {
    const { root, write, seal } = fixture();
    write(
      "apps/web/.next/required-server-files.json",
      JSON.stringify({ config: { deploymentId: "community-one" } })
    );
    seal();
    expect(verify(root).stderr).toContain("Unexpected Next deployment identity");
  });

  test("rejects overwritten assets without printing their contents", () => {
    const { root, write } = fixture();
    write("apps/web/.next/static/chunks/login.css", "private-value-sentinel");
    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Runtime artifact contents changed");
    expect(result.stderr).not.toContain("private-value-sentinel");
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
  });

  test("rejects extra stale files, not only missing files", () => {
    const { root, write } = fixture();
    write("apps/web/.next/static/chunks/old.js", "old");
    expect(verify(root).status).toBe(1);
  });

  test("rejects absent inventories", () => {
    const { root } = fixture();
    expect(JSON.parse(readFileSync(join(root, "next-runtime.json"), "utf8")).version).toBe(1);
    rmSync(join(root, "next-runtime.json"));
    expect(verify(root).status).toBe(1);
  });
});
