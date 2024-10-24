import { registerOTel } from "@vercel/otel";
import { LangfuseExporter } from "langfuse-vercel";
import { env } from "@formbricks/lib/env";

export async function register() {
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

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
