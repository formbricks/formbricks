// OpenTelemetry instrumentation for Next.js - loaded via instrumentation.ts hook
// Pattern based on: ee/src/opentelemetry.ts (license server)
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  BatchSpanProcessor,
  ParentBasedSampler,
  type Sampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { logger } from "@formbricks/logger";

// --- Configuration from environment ---
const serviceName = process.env.OTEL_SERVICE_NAME || "formbricks";
const serviceVersion = process.env.npm_package_version || "0.0.0";
const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || "development";
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const prometheusEnabled = process.env.PROMETHEUS_ENABLED === "1";
const prometheusPort = process.env.PROMETHEUS_EXPORTER_PORT
  ? Number.parseInt(process.env.PROMETHEUS_EXPORTER_PORT)
  : 9464;

// --- Configure OTLP exporters (conditional on endpoint being set) ---
let traceExporter: OTLPTraceExporter | undefined;
let otlpMetricExporter: OTLPMetricExporter | undefined;

if (otlpEndpoint) {
  try {
    // OTLPTraceExporter reads OTEL_EXPORTER_OTLP_ENDPOINT from env
    // and appends /v1/traces for HTTP transport
    // Uses OTEL_EXPORTER_OTLP_HEADERS from env natively (W3C OTel format: key=value,key2=value2)
    traceExporter = new OTLPTraceExporter();

    // OTLPMetricExporter reads OTEL_EXPORTER_OTLP_ENDPOINT from env
    // and appends /v1/metrics for HTTP transport
    // Uses OTEL_EXPORTER_OTLP_HEADERS from env natively
    otlpMetricExporter = new OTLPMetricExporter();
  } catch (error) {
    logger.error(error, "Failed to create OTLP exporters. Telemetry will not be exported.");
  }
}

// --- Configure Prometheus exporter (pull-based metrics for ServiceMonitor) ---
let prometheusExporter: PrometheusExporter | undefined;
if (prometheusEnabled) {
  prometheusExporter = new PrometheusExporter({
    port: prometheusPort,
    endpoint: "/metrics",
    host: "0.0.0.0",
  });
}

// --- Build metric readers array ---
const metricReaders: (PeriodicExportingMetricReader | PrometheusExporter)[] = [];

if (otlpMetricExporter) {
  metricReaders.push(
    new PeriodicExportingMetricReader({
      exporter: otlpMetricExporter,
      exportIntervalMillis: 60000, // Export every 60 seconds
    })
  );
}

if (prometheusExporter) {
  metricReaders.push(prometheusExporter);
}

// --- Resource attributes ---
const resourceAttributes: Record<string, string> = {
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
  "deployment.environment": environment,
};

// --- Configure sampler ---
const samplerType = process.env.OTEL_TRACES_SAMPLER || "always_on";
const parsedSamplerArg = process.env.OTEL_TRACES_SAMPLER_ARG
  ? Number.parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG)
  : undefined;
const samplerArg =
  parsedSamplerArg !== undefined && !Number.isNaN(parsedSamplerArg) ? parsedSamplerArg : undefined;

let sampler: Sampler;
switch (samplerType) {
  case "always_on":
    sampler = new AlwaysOnSampler();
    break;
  case "always_off":
    sampler = new AlwaysOffSampler();
    break;
  case "traceidratio":
    sampler = new TraceIdRatioBasedSampler(samplerArg ?? 1);
    break;
  case "parentbased_traceidratio":
    sampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(samplerArg ?? 1),
    });
    break;
  case "parentbased_always_on":
    sampler = new ParentBasedSampler({
      root: new AlwaysOnSampler(),
    });
    break;
  case "parentbased_always_off":
    sampler = new ParentBasedSampler({
      root: new AlwaysOffSampler(),
    });
    break;
  default:
    logger.warn(`Unknown sampler type: ${samplerType}. Using always_on.`);
    sampler = new AlwaysOnSampler();
}

// --- Initialize NodeSDK ---
const sdk = new NodeSDK({
  sampler,
  resource: resourceFromAttributes(resourceAttributes),
  // When no OTLP endpoint is configured (e.g. Prometheus-only setups), pass an empty
  // spanProcessors array to prevent the SDK from falling back to its default OTLP exporter
  // which would attempt connections to localhost:4318 and cause noisy errors.
  spanProcessors: traceExporter
    ? [
        new BatchSpanProcessor(traceExporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
        }),
      ]
    : [],
  metricReaders: metricReaders.length > 0 ? metricReaders : undefined,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable noisy/unnecessary instrumentations
      "@opentelemetry/instrumentation-fs": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-dns": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-net": {
        enabled: false,
      },
      // Disable pg instrumentation - PrismaInstrumentation handles DB tracing
      "@opentelemetry/instrumentation-pg": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-http": {
        // Ignore health/metrics endpoints to reduce noise
        ignoreIncomingRequestHook: (req) => {
          const url = req.url || "";
          return url === "/health" || url.startsWith("/metrics") || url === "/api/v2/health";
        },
      },
      // Enable runtime metrics for Node.js process monitoring
      "@opentelemetry/instrumentation-runtime-node": {
        enabled: true,
      },
    }),
    // Prisma instrumentation for database query tracing
    new PrismaInstrumentation(),
  ],
});

// Start the SDK
sdk.start();

// --- Log initialization status ---
const enabledFeatures: string[] = [];
if (traceExporter) enabledFeatures.push("traces");
if (otlpMetricExporter) enabledFeatures.push("otlp-metrics");
if (prometheusExporter) enabledFeatures.push("prometheus-metrics");

const samplerArgStr = process.env.OTEL_TRACES_SAMPLER_ARG || "";
const samplerArgMsg = samplerArgStr ? `, samplerArg=${samplerArgStr}` : "";

if (enabledFeatures.length > 0) {
  logger.info(
    `OpenTelemetry initialized: service=${serviceName}, version=${serviceVersion}, environment=${environment}, exporters=${enabledFeatures.join("+")}, sampler=${samplerType}${samplerArgMsg}`
  );
} else {
  logger.info(
    `OpenTelemetry initialized (no exporters): service=${serviceName}, version=${serviceVersion}, environment=${environment}`
  );
}

// --- Graceful shutdown ---
// Run before other SIGTERM listeners (logger flush, etc.) so spans are drained first.
process.prependListener("SIGTERM", async () => {
  try {
    await sdk.shutdown();
  } catch (e) {
    logger.error(e, "Error during OpenTelemetry shutdown");
  }
});
