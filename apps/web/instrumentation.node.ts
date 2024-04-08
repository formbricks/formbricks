import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function startInstrumentationForNode(url: string) {
  try {
    const exporter = new OTLPTraceExporter({
      url,
    });

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: "Formbricks",
      }),
      traceExporter: exporter,
      spanProcessor: new SimpleSpanProcessor(exporter),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
  } catch (err) {
    console.error(`Unable to setup Telemetry: ${err}`);
  }
}
