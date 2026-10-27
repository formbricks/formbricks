import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { assembleNextRuntime } from "../../apps/web/scripts/docker/build-next-runtime.mjs";
import { runtimeInventory, verifyNextRuntime } from "../../apps/web/scripts/docker/verify-next-runtime.mjs";

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
  spawnSync(process.execPath, [verifier, id, variant], { cwd: root, encoding: "utf8" });

afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }))
);

describe("Next runtime artifact", () => {
  test("preserves traced dependency links when the build directory no longer exists", () => {
    const { root } = fixture();
    const source = mkdtempSync(join(tmpdir(), "next-source-"));
    const output = mkdtempSync(join(tmpdir(), "next-output-"));
    directories.push(source, output);
    const web = join(source, "apps/web");
    const standalone = join(web, ".next/standalone");
    cpSync(root, standalone, { recursive: true });
    cpSync(join(root, "apps/web/.next/static"), join(web, ".next/static"), { recursive: true });
    cpSync(join(root, "apps/web/public"), join(web, "public"), { recursive: true });
    mkdirSync(join(web, "scripts/docker"), { recursive: true });
    for (const file of ["server.js", "shutdown.js"]) writeFileSync(join(web, "scripts/docker", file), "{}");
    cpSync(verifier, join(web, "scripts/docker/verify-next-runtime.mjs"));
    const dependency = join(standalone, "node_modules/fixture");
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, "index.js"), "module.exports = 42;");
    const link = join(standalone, "apps/web/.next/node_modules/fixture");
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(relative(dirname(link), dependency), link);

    assembleNextRuntime(web, output, "cloud-one", "ecr");
    rmSync(source, { recursive: true });
    const packagedDependency = join(output, "apps/web/.next/node_modules/fixture/index.js");
    expect(readFileSync(packagedDependency, "utf8")).toBe("module.exports = 42;");
    expect(realpathSync(packagedDependency)).toBe(
      realpathSync(join(output, "node_modules/fixture/index.js"))
    );
    expect(verify(output).status).toBe(0);
  });

  test("accepts a complete artifact, including a local build without a CI-supplied identity", () => {
    const { root } = fixture();
    expect(verify(root).status).toBe(0);
    expect(verify(root, "", "").status).toBe(0);
  });

  test("allows the runner to complete traced dependency packages without altering the application inventory", () => {
    const { root, write, seal } = fixture();
    write("apps/web/.next/node_modules/prisma/index.js", "traced dependency");
    seal();
    write("apps/web/.next/node_modules/prisma/index.d.ts", "full dependency overlay");
    expect(verify(root).status).toBe(0);
  });

  test.each(missingApolloFiles)(
    "rejects Apollo's missing bootstrap asset %s even with valid inventory hashes",
    (file) => {
      const { root, seal } = fixture();
      rmSync(join(root, "apps/web/.next/static/chunks", file));
      seal();
      const result = verify(root);
      expect(result.status).toBe(1);
      expect(() => verifyNextRuntime(root)).toThrow(`Missing Next asset: static/chunks/${file}`);
    }
  );

  test("checks route-specific CSS beyond the root bootstrap", () => {
    const { root, seal } = fixture();
    rmSync(join(root, "apps/web/.next/static/chunks/login.css"));
    seal();
    expect(() => verifyNextRuntime(root)).toThrow("Missing Next asset: static/chunks/login.css");
    expect(verify(root).stderr.trim()).toBe(
      "Next runtime verification failed: Missing Next asset: static/chunks/login.css"
    );
  });

  test("rejects a coherent but stale build or a different release variant", () => {
    const { root } = fixture();
    const mismatch = verify(root, "private-value-sentinel");
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr.trim()).toBe(
      "Next runtime verification failed: Unexpected runtime artifact identity"
    );
    expect(mismatch.stderr).not.toContain("private-value-sentinel");
    const variant = verify(root, "cloud-one", "ghcr");
    expect(variant.status).toBe(1);
    expect(variant.stderr.trim()).toBe(
      "Next runtime verification failed: Unexpected runtime artifact variant"
    );
  });

  test("rejects a mixed server configuration before serving any requests", () => {
    const { root, write, seal } = fixture();
    write(
      "apps/web/.next/required-server-files.json",
      JSON.stringify({ config: { deploymentId: "community-one" } })
    );
    seal();
    expect(() => verifyNextRuntime(root)).toThrow("Unexpected Next deployment identity");
  });

  test("rejects overwritten assets without printing their contents", () => {
    const { root, write } = fixture();
    write("apps/web/.next/static/chunks/login.css", "private-value-sentinel");
    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Runtime artifact contents changed after assembly: .next/static/chunks/login.css"
    );
    expect(() => verifyNextRuntime(root)).toThrow("Runtime artifact contents changed");
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

  test.each([[], ["cloud-one", "ecr"]])(
    "CLI arguments cannot redirect verification to another directory (%j)",
    (...suffix) => {
      const broken = fixture();
      const valid = fixture();
      rmSync(join(broken.root, "next-runtime.json"));
      const result = spawnSync(process.execPath, [verifier, valid.root, ...suffix], {
        cwd: broken.root,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Next runtime verification failed");
      expect(result.stderr).not.toContain(valid.root);
    }
  );

  test("successful CLI output never includes manifest values", () => {
    const { root, write } = fixture();
    const metadata = JSON.parse(readFileSync(join(root, "next-runtime.json"), "utf8"));
    write("next-runtime.json", JSON.stringify({ ...metadata, variant: "private-value-sentinel" }));
    const result = verify(root, "", "");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("Next runtime verification passed");
    expect(result.stderr).toBe("");
  });

  test("malformed manifests cannot leak JSON excerpts through CLI errors", () => {
    const { root, write } = fixture();
    write("next-runtime.json", '{"token":"private-value-sentinel" broken');
    const result = verify(root);
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("Next runtime verification failed");
    expect(result.stdout).toBe("");
  });
});
