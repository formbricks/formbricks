import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function buildIdentity(env) {
  const inputs = {
    revision: env.GITHUB_SHA,
    variant: env.REGISTRY_TYPE,
    version: env.BUILD_VERSION,
    sentry: Boolean(env.SENTRY_AUTH_TOKEN),
    posthog: env.POSTHOG_KEY || "",
    // Normal reruns reuse the artifact. An explicit repair gets a new deployment identity.
    repair: env.REBUILD_APPLICATION === "true" ? `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}` : "",
  };
  if (!inputs.revision || !inputs.variant || !inputs.version)
    throw new Error("Missing build identity inputs");
  return createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(buildIdentity(process.env));
}
