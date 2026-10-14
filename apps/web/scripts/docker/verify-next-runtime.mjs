import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

// These files move together. Dependencies are separately traced by Next and checked by verify-runtime.mjs.
export function runtimeInventory(root) {
  const web = join(root, "apps/web");
  const files = ["package.json", "server.js", "online-server.js", "shutdown.js"];
  for (const directory of [".next", "public"]) {
    for (const file of readdirSync(join(web, directory), { recursive: true, withFileTypes: true })) {
      if (file.isFile()) files.push(join(file.parentPath, file.name).slice(web.length + 1));
    }
  }
  return Object.fromEntries(files.sort().map((file) => [file, hash(join(web, file))]));
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
    console.log(JSON.stringify(verifyNextRuntime(process.argv[2] || ".", process.argv[3], process.argv[4])));
  } catch (error) {
    // Do not dump inventories, config objects or embedded build-time values in assertion errors.
    console.error(error.message.split("\n")[0]);
    process.exitCode = 1;
  }
}
