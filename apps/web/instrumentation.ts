import { env } from "@formbricks/lib/env";

// instrumentation.ts
export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs" && env.PROMETHEUS_ENABLED) {
    await import("./instrumentation-node");
  }
};
