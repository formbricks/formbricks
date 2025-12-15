import "server-only";
import { logger } from "@formbricks/logger";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __FORMBRICKS_GLOBAL_AGENT_INITIALIZED: boolean | undefined;
}

export const setupGlobalAgentProxy = (): void => {
  if (globalThis.window !== undefined) {
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
    const { bootstrap } = require("global-agent");
    bootstrap();
    globalThis.__FORMBRICKS_GLOBAL_AGENT_INITIALIZED = true;
    logger.info("Enabled global-agent proxy support for outbound HTTP requests");
  } catch (error) {
    logger.error("Failed to enable global-agent proxy support", error);
  }
};
