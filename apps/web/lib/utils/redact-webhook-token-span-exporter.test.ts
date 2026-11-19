import { SpanStatusCode } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createWebhookTokenRedactingExporter } from "./redact-webhook-token-span-exporter";

const TOKEN = "q8Zk3vT1xN2yR5wP7mC4bA";
const SECRET_PATH = `/api/v3/workflows/cm9zr4t2b000208l8h2m1aq3c/webhook/${TOKEN}`;
const REDACTED_PATH = "/api/v3/workflows/cm9zr4t2b000208l8h2m1aq3c/webhook/[redacted]";

const memory = new InMemorySpanExporter();
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(createWebhookTokenRedactingExporter(memory))],
});
const tracer = provider.getTracer("test");

afterEach(() => memory.reset());

describe("createWebhookTokenRedactingExporter", () => {
  test("removes the token from the name, attributes, events and status of an exported span", () => {
    const span = tracer.startSpan(`POST ${SECRET_PATH}`, {
      attributes: {
        "url.full": `https://app.example.com${SECRET_PATH}?a=1`,
        "http.target": SECRET_PATH,
        "next.route": "/api/v3/workflows/[workflowId]/webhook/[token]",
        "http.status_code": 202,
        "example.paths": [SECRET_PATH, "/health"],
      },
    });
    span.addEvent("exception", { "exception.message": `Failed ${SECRET_PATH}` });
    span.setStatus({ code: SpanStatusCode.ERROR, message: `Failed ${SECRET_PATH}` });
    span.end();

    const [exported] = memory.getFinishedSpans();
    expect(JSON.stringify(exported)).not.toContain(TOKEN);
    expect(exported.name).toBe(`POST ${REDACTED_PATH}`);
    expect(exported.attributes).toEqual({
      "url.full": `https://app.example.com${REDACTED_PATH}?a=1`,
      "http.target": REDACTED_PATH,
      "next.route": "/api/v3/workflows/[workflowId]/webhook/[redacted]",
      "http.status_code": 202,
      "example.paths": [REDACTED_PATH, "/health"],
    });
    expect(exported.events[0].attributes).toEqual({ "exception.message": `Failed ${REDACTED_PATH}` });
    expect(exported.status).toEqual({ code: SpanStatusCode.ERROR, message: `Failed ${REDACTED_PATH}` });
  });

  test("keeps the rest of the span: its context, timing and resource", () => {
    const span = tracer.startSpan("GET /api/v3/workflows");
    span.end();

    const [exported] = memory.getFinishedSpans();
    expect(exported.spanContext()).toEqual(span.spanContext());
    expect(exported.duration).toEqual((span as unknown as { duration: unknown }).duration);
    expect(exported.ended).toBe(true);
    expect(exported.resource).toBeDefined();
    expect(exported.name).toBe("GET /api/v3/workflows");
  });

  test("passes shutdown and forceFlush through", async () => {
    const inner: SpanExporter = {
      export: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };
    const exporter = createWebhookTokenRedactingExporter(inner);

    await exporter.forceFlush?.();
    await exporter.shutdown();

    expect(inner.forceFlush).toHaveBeenCalledOnce();
    expect(inner.shutdown).toHaveBeenCalledOnce();
  });
});
