import { env } from "@formbricks/lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && env.OPENTELEMETRY_LISTENER_URL) {
    const { startInstrumentationForNode } = await import("./instrumentation.node");

    startInstrumentationForNode(env.OPENTELEMETRY_LISTENER_URL);
  }
}
