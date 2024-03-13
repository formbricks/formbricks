import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

import { SIGNOZ_LISTENER_URL } from "@formbricks/lib/constants";

export function startInstrumentationForNode() {
  const exporter = new OTLPTraceExporter({
    url: SIGNOZ_LISTENER_URL,
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: "SigNoz-Nextjs",
    }),
    spanProcessor: new SimpleSpanProcessor(exporter),
  });

  sdk.start();
}
