import { describe, expect, test } from "vitest";
import { nodeAutoInstrumentationConfig } from "./instrumentation-node-config";

describe("nodeAutoInstrumentationConfig", () => {
  test("leaves Pino log export to the OTEL_LOGS_ENABLED transport", () => {
    expect(nodeAutoInstrumentationConfig["@opentelemetry/instrumentation-pino"]).toMatchObject({
      disableLogSending: true,
    });
  });

  test.each([
    "/health",
    "/health?probe=1",
    "/metrics",
    "/metrics?format=prometheus",
    "/metrics/runtime",
    "/api/v2/health",
    "/api/v2/health?probe=1",
  ])("ignores the %s endpoint", (url) => {
    const config = nodeAutoInstrumentationConfig["@opentelemetry/instrumentation-http"];
    expect(config?.ignoreIncomingRequestHook?.({ url } as never)).toBe(true);
  });

  test.each(["/auth/login", "/metrics-dashboard"])("instruments the %s route", (url) => {
    const config = nodeAutoInstrumentationConfig["@opentelemetry/instrumentation-http"];
    expect(config?.ignoreIncomingRequestHook?.({ url } as never)).toBe(false);
  });
});
