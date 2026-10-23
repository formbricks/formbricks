import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// createRequire also supports CI's isolated NODE_PATH parser installation.
const { load, loadAll } = createRequire(import.meta.url)("js-yaml");
const readYaml = (path) => load(readFileSync(path, "utf8"));

export function composeDefault(value) {
  // Read committed defaults, never the runner's environment or a local .env file.
  const result = value.replace(/\$\{[A-Za-z_][A-Za-z0-9_]*:-([^{}]*)\}/g, "$1");
  if (result.includes("$") || !result || /\s/.test(result)) {
    throw new Error(`Image needs an explicit committed default: ${value}`);
  }
  return result;
}

export function collectImages(node, found = new Set()) {
  if (!node || typeof node !== "object") return found;
  for (const [key, value] of Object.entries(node)) {
    if (key === "image" && typeof value === "string" && value) found.add(composeDefault(value));
    if (value && typeof value === "object") collectImages(value, found);
  }
  // An operator creates this Deployment after Helm has finished rendering.
  if (node.kind === "SpiceDBCluster") found.add(`authzed/spicedb:${node.spec.version}`);
  // Envoy Gateway embeds its configuration (including the rate-limit image) in a ConfigMap string.
  if (node.kind === "ConfigMap") {
    for (const [name, value] of Object.entries(node.data ?? {})) {
      if (/\.ya?ml$/.test(name)) collectImages(load(value), found);
    }
  }
  return found;
}

export function inventory(run = execFileSync) {
  const images = new Map();
  const add = (image, source) => {
    if (!images.has(image)) images.set(image, new Set());
    images.get(image).add(source);
  };
  // Both files ship image defaults; parsing all services includes Compose profiles without starting anything.
  for (const file of ["docker/docker-compose.yml", "docker-compose.dev.yml"]) {
    for (const [name, service] of Object.entries(readYaml(file).services)) {
      if (service.image) add(composeDefault(service.image), `${file}#${name}`);
    }
  }
  for (const profile of [null, "scripts/container-security/profiles.yaml"]) {
    const args = [
      "template",
      "security",
      "charts/formbricks",
      "--set",
      "formbricks.webappUrl=https://security-scan.invalid",
    ];
    if (profile) args.push("--values", profile);
    const rendered = run("helm", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    for (const doc of loadAll(rendered)) {
      for (const image of collectImages(doc))
        add(image, `charts/formbricks#${profile ? "optional" : "default"}`);
    }
  }
  const operators = JSON.parse(readFileSync("scripts/container-security/operator-images.json", "utf8"));
  const gateway = readYaml("charts/formbricks/Chart.yaml").dependencies.find((d) => d.alias === "envoy");
  if (gateway.version !== operators.gatewayChartVersion) {
    throw new Error("Update operator-images.json from the new Envoy Gateway release before scanning");
  }
  add(operators.envoyProxyImage, operators.source);
  return [...images]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([image, sources]) => ({ image, sources: [...sources] }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(process.argv[2] ?? "image-inventory.json", JSON.stringify(inventory(), null, 2) + "\n");
}
