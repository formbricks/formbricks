import { metrics } from "@opentelemetry/api";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { registerOTel } from "@vercel/otel";
import { env } from "@formbricks/lib/env";

export async function register() {
  // Set up Prometheus metrics exporter if configured
  if (env.ENABLE_PROMETHEUS_METRICS === "1" && process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Create a Prometheus exporter
      const prometheusExporter = new PrometheusExporter({
        port: parseInt(env.PROMETHEUS_EXPORTER_PORT || "9464", 10),
        // The endpoint defaults to /metrics
      });

      // Create a meter provider and register the exporter
      const meterProvider = new MeterProvider();
      meterProvider.addMetricReader(prometheusExporter);

      // Set the global meter provider
      metrics.setGlobalMeterProvider(meterProvider);

      console.log(
        `Prometheus metrics exporter initialized on port ${env.PROMETHEUS_EXPORTER_PORT || "9464"}`
      );

      // Get a meter to create instruments
      const meter = metrics.getMeter("formbricks-metrics");

      // Example counter metric
      const requestCounter = meter.createCounter("http_requests_total", {
        description: "Total number of HTTP requests",
      });

      // Example histogram metric
      const requestDuration = meter.createHistogram("http_request_duration_seconds", {
        description: "HTTP request duration in seconds",
      });

      // Create some additional business metrics
      const surveyResponseCounter = meter.createCounter("survey_responses_total", {
        description: "Total number of survey responses",
      });

      const surveyCompletionTime = meter.createHistogram("survey_completion_time_seconds", {
        description: "Time taken to complete a survey in seconds",
      });

      // Expose these metrics globally for use in the application
      if (typeof global !== "undefined") {
        (global as any).__FORMBRICKS_METRICS = {
          requestCounter,
          requestDuration,
          surveyResponseCounter,
          surveyCompletionTime,
        };
      }

      // Generate some test metrics immediately
      requestCounter.add(1, { method: "GET", path: "/test" });
      surveyResponseCounter.add(1, { surveyType: "nps" });
    } catch (error) {
      console.error("Failed to initialize Prometheus metrics exporter:", error);
    }
  }

  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    registerOTel({
      serviceName: env.OTEL_SERVICE_NAME || "formbricks-web",
      attributes: {
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV || "development",
      },
      traceExporter: new OTLPTraceExporter({
        url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
        headers: env.OTEL_EXPORTER_OTLP_HEADERS ? JSON.parse(env.OTEL_EXPORTER_OTLP_HEADERS) : undefined,
      }),
    });
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
