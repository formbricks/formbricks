// instrumentation-node.ts
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { HostMetrics } from "@opentelemetry/host-metrics";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import {
  Resource,
  detectResourcesSync,
  envDetector,
  hostDetector,
  processDetector,
} from "@opentelemetry/resources";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { env } from "@formbricks/lib/env";

const exporter = new PrometheusExporter({
  port: env.PROMETHEUS_EXPORTER_PORT ? parseInt(env.PROMETHEUS_EXPORTER_PORT) : 9464,
  endpoint: "/metrics",
  host: "0.0.0.0", // Listen on all network interfaces
});

const detectedResources = detectResourcesSync({
  detectors: [envDetector, processDetector, hostDetector],
});

const customResources = new Resource({});

const resources = detectedResources.merge(customResources);

const meterProvider = new MeterProvider({
  readers: [exporter],
  resource: resources,
});

const hostMetrics = new HostMetrics({
  name: `otel-metrics`,
  meterProvider,
});

registerInstrumentations({
  meterProvider,
  instrumentations: [new HttpInstrumentation(), new RuntimeNodeInstrumentation()],
});

hostMetrics.start();

process.on("SIGTERM", async () => {
  try {
    // Stop collecting metrics or flush them if needed
    await meterProvider.shutdown();
    // Possibly close other instrumentation resources
  } catch (e) {
    console.error("Error during graceful shutdown:", e);
  } finally {
    process.exit(0);
  }
});
