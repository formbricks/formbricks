import { registerOTel } from "@vercel/otel";
import { LangfuseExporter } from "langfuse-vercel";
import { env } from "@formbricks/lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_BASEURL) {
      registerOTel({
        serviceName: "formbricks-cloud-dev",
        traceExporter: new LangfuseExporter({
          debug: false,
          secretKey: env.LANGFUSE_SECRET_KEY,
          publicKey: env.LANGFUSE_PUBLIC_KEY,
          baseUrl: env.LANGFUSE_BASEURL,
        }),
      });
    }

    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("./sentry.server.config");
    }

    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_EXPORTER_OTLP_HEADERS) {
      const { startOtel } = await import("@infrastack/otel");
      startOtel({
        serviceName: "formbricks-web",
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
