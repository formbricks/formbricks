import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

// These files move together. Dependencies are separately traced by Next and checked by verify-runtime.mjs.
export function runtimeInventory(root) {
  const web = resolve(root, "apps/web");
  const files = ["package.json", "server.js", "online-server.js", "shutdown.js"];
  const visit = (directory) => {
    for (const file of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, file.name);
      // The runner deliberately overlays full Prisma/logger packages onto traced dependencies.
      // Do not follow Next's dependency symlinks or include their mutable package contents.
      if (file.isDirectory() && file.name !== "node_modules") visit(path);
      else if (file.isFile()) files.push(relative(web, path));
    }
  };
  for (const directory of [".next", "public"]) visit(join(web, directory));
  const sortedFiles = files.toSorted((left, right) => left.localeCompare(right, "en"));
  return Object.fromEntries(sortedFiles.map((file) => [file, hash(join(web, file))]));
}

export function verifyNextAssets(root, expectedId) {
  const next = join(root, "apps/web/.next");
  const { config } = readJson(join(next, "required-server-files.json"));
  assert.ok(config.deploymentId, "Missing Next deployment identity");
  if (expectedId) assert.equal(config.deploymentId, expectedId, "Unexpected Next deployment identity");
  assert.ok(readFileSync(join(next, "BUILD_ID"), "utf8").trim(), "Missing Next build identity");
  const manifest = readJson(join(next, "build-manifest.json"));
  assert.ok(manifest.rootMainFiles?.length, "Missing browser bootstrap files");
  const references = new Set();
  const collect = (value) => {
    if (typeof value === "string" && value.startsWith("static/")) references.add(value);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(manifest);
  // App Router client manifests include route-specific scripts and CSS beyond rootMainFiles.
  for (const file of readdirSync(join(next, "server"), { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith("client-reference-manifest.js")) continue;
    const source = readFileSync(join(file.parentPath, file.name), "utf8");
    for (const [reference] of source.matchAll(/static\/(?:chunks|media)\/[a-zA-Z0-9_./-]+/g)) {
      references.add(reference);
    }
  }
  for (const reference of references) {
    assert.ok(resolve(next, reference).startsWith(resolve(next) + "/"), "Invalid asset reference");
    assert.ok(existsSync(join(next, reference)), `Missing Next asset: ${reference}`);
  }
  return { deploymentId: config.deploymentId, assets: references.size };
}

export function verifyNextRuntime(root, expectedId, expectedVariant) {
  const metadata = readJson(join(root, "next-runtime.json"));
  assert.equal(metadata.version, 1, "Unknown runtime artifact format");
  if (expectedId) assert.equal(metadata.deploymentId, expectedId, "Unexpected runtime artifact identity");
  if (expectedVariant) assert.equal(metadata.variant, expectedVariant, "Unexpected runtime artifact variant");
  const result = verifyNextAssets(root, metadata.deploymentId);
  const actual = runtimeInventory(root);
  const changed = [...new Set([...Object.keys(actual), ...Object.keys(metadata.files)])].filter(
    (file) => actual[file] !== metadata.files[file]
  );
  assert.equal(
    changed.length,
    0,
    `Runtime artifact contents changed after assembly: ${changed.slice(0, 8).join(", ")}`
  );
  return { ...result, variant: metadata.variant, files: Object.keys(metadata.files).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    // The CLI only verifies its working directory; arguments cannot select another filesystem tree.
    assert.ok(process.argv.length <= 4, "Expected only build identity and variant");
    verifyNextRuntime(process.cwd(), process.argv[2], process.argv[3]);
    console.log("Next runtime verification passed");
  } catch (error) {
    // Our assertion messages contain only fixed diagnostics and file paths. Node appends
    // actual/expected values after a newline; never log those or unexpected JSON errors.
    const detail = error instanceof assert.AssertionError ? error.message.split("\n", 1)[0] : "";
    console.error("Next runtime verification failed%s", detail ? `: ${detail}` : "");
    process.exitCode = 1;
  }
}
