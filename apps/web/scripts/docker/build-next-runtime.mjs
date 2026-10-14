import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runtimeInventory, verifyNextAssets, verifyNextRuntime } from "./verify-next-runtime.mjs";

export function assembleNextRuntime(web, root, deploymentId, variant) {
  // Assemble within the SAME build step, before any independently cached COPY can mix two compilations.
  rmSync(root, { recursive: true, force: true });
  cpSync(join(web, ".next/standalone"), root, { recursive: true, verbatimSymlinks: true });
  const target = join(root, "apps/web");
  mkdirSync(join(target, ".next"), { recursive: true });
  cpSync(join(web, ".next/static"), join(target, ".next/static"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  cpSync(join(web, "public"), join(target, "public"), { recursive: true, verbatimSymlinks: true });
  cpSync(join(web, "scripts/docker/server.js"), join(target, "online-server.js"));
  cpSync(join(web, "scripts/docker/shutdown.js"), join(target, "shutdown.js"));
  cpSync(join(web, "scripts/docker/verify-next-runtime.mjs"), join(root, "verify-next-runtime.mjs"));
  verifyNextAssets(root, deploymentId);
  writeFileSync(
    join(root, "next-runtime.json"),
    JSON.stringify({ version: 1, deploymentId, variant, files: runtimeInventory(root) })
  );
  verifyNextRuntime(root, deploymentId, variant);
  console.log("Next runtime assembled and verified");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // CI supplies an identity before Docker computes cache keys. Local Docker builds remain supported.
  const deploymentId = process.env.FORMBRICKS_DEPLOYMENT_ID || `local-${randomUUID()}`;
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- Artifact metadata is assembled outside the Turbo task graph.
  const variant = process.env.FORMBRICKS_BUILD_VARIANT || "local";
  const web = join(process.cwd(), "apps/web");
  rmSync(join(web, ".next"), { recursive: true, force: true });
  // Corepack installs this shim in the Docker installer's root-owned executable directory.
  const build = spawnSync("/usr/local/bin/pnpm", ["build", "--filter=@formbricks/web..."], {
    stdio: "inherit",
    env: { ...process.env, FORMBRICKS_DEPLOYMENT_ID: deploymentId },
  });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status || 1);

  assembleNextRuntime(web, join(process.cwd(), "next-runtime"), deploymentId, variant);
}
