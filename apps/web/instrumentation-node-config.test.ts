import { describe, expect, test } from "vitest";
import { nodeAutoInstrumentationConfig } from "./instrumentation-node-config";

describe("nodeAutoInstrumentationConfig", () => {
  test("leaves Pino log export to the OTEL_LOGS_ENABLED transport", () => {
    expect(nodeAutoInstrumentationConfig["@opentelemetry/instrumentation-pino"]).toMatchObject({
      disableLogSending: true,
    });
  });

  test.each(["/health", "/metrics", "/metrics/runtime", "/api/v2/health"])(
    "ignores the %s endpoint",
    (url) => {
      const config = nodeAutoInstrumentationConfig["@opentelemetry/instrumentation-http"];
      expect(config?.ignoreIncomingRequestHook?.({ url } as never)).toBe(true);
    }
  );

  test("instruments application routes", () => {
    const config = nodeAutoInstrumentationConfig["@opentelemetry/instrumentation-http"];
    expect(config?.ignoreIncomingRequestHook?.({ url: "/auth/login" } as never)).toBe(false);
  });
});
