import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function startInstrumentationForNode(signozUrl: string) {
  const exporter = new OTLPTraceExporter({
    url: signozUrl,
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: "SigNoz-Kamal-Formbricks",
    }),
    spanProcessor: new SimpleSpanProcessor(exporter),
  });

  sdk.start();
}
