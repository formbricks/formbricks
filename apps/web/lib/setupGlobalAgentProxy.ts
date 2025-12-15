import "server-only";
import { logger } from "@formbricks/logger";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __FORMBRICKS_GLOBAL_AGENT_INITIALIZED: boolean | undefined;
}

export const setupGlobalAgentProxy = (): void => {
  // Only run in a Node.js runtime; skip edge/serverless where Node built-ins (net/tls) are missing
  if (globalThis.window !== undefined) {
    return;
  }
  // Hard guard: only run in real Node.js runtime (not edge/serverless)
  if (
    globalThis.process === undefined ||
    globalThis.process.release?.name !== "node" ||
    globalThis.process.versions?.node === undefined
  ) {
    return;
  }

  if (globalThis.__FORMBRICKS_GLOBAL_AGENT_INITIALIZED) {
    return;
  }

  const isEnabled = env.USE_GLOBAL_AGENT_PROXY === "1";

  if (!isEnabled) {
    return;
  }

  // Resolve NO_PROXY value from validated env
  const noProxy = env.GLOBAL_AGENT_NO_PROXY ?? env.NO_PROXY;

  // Set GLOBAL_AGENT_NO_PROXY in process.env for global-agent to read
  if (noProxy) {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.GLOBAL_AGENT_NO_PROXY = noProxy;
  }

  try {
    // Dynamic require prevents bundling into edge/serverless builds
    // Using string concatenation to prevent webpack from statically analyzing the require
    // eslint-disable-next-line @typescript-eslint/no-var-requires, turbo/no-undeclared-env-vars
    const { bootstrap } = require("global" + "-agent");
    bootstrap();
    globalThis.__FORMBRICKS_GLOBAL_AGENT_INITIALIZED = true;
    logger.info("Enabled global-agent proxy support for outbound HTTP requests");
  } catch (error) {
    logger.error("Failed to enable global-agent proxy support", error);
  }
};
