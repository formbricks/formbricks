import { describe, expect, test } from "vitest";
import { getMetricExportIntervalMs, nodeAutoInstrumentationConfig } from "./instrumentation-node-config";

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

describe("getMetricExportIntervalMs", () => {
  test("honours a positive integer interval", () => {
    expect(getMetricExportIntervalMs("15000")).toBe(15_000);
  });

  test("honours the longest interval Node's timers allow", () => {
    expect(getMetricExportIntervalMs("2147483647")).toBe(2_147_483_647);
  });

  test.each([undefined, "", "0", "-5", "15s", "1.5", "2147483648", "2592000000"])(
    "falls back to 60 s for %j",
    (value) => {
      expect(getMetricExportIntervalMs(value)).toBe(60_000);
    }
  );
});
