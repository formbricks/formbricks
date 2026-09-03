import { afterEach, describe, expect, test, vi } from "vitest";
import type { TSurveyGenerationStreamEvent } from "@/app/api/internal/surveys/generate/lib/events";
import { streamSurveyGeneration } from "./ai-generate-stream-client";

const encoder = new TextEncoder();

/** A response whose body yields the given NDJSON chunks and then ends. */
const respondWith = (chunks: string[]) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
          controller.close();
        },
      }),
    })
  );
};

const body = { workspaceId: "w1", prompt: "a prompt", type: "link", language: "en-US" } as const;

const collect = async () => {
  const events: TSurveyGenerationStreamEvent[] = [];
  await streamSurveyGeneration(body, {
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event),
  });
  return events;
};

describe("streamSurveyGeneration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("delivers every event in order", async () => {
    respondWith([
      '{"type":"start","requestId":"req_1"}\n',
      '{"type":"partial","seq":1,"draft":{"name":"Onboarding"}}\n',
      '{"type":"error","code":"ai_output_too_long","detail":"too long"}\n',
    ]);

    expect((await collect()).map((event) => event.type)).toEqual(["start", "partial", "error"]);
  });

  test("throws when the body ends without a terminal event", async () => {
    // A dropped connection or a proxy cutting the response would otherwise leave the caller waiting
    // forever in its generating state, with the unload guard still armed.
    respondWith(['{"type":"start","requestId":"req_1"}\n', '{"type":"partial","seq":1,"draft":{}}\n']);

    await expect(collect()).rejects.toThrow(/without a result/);
  });

  test("does not throw once a terminal event has arrived", async () => {
    respondWith(['{"type":"done","language":"en","payload":{},"validation":{}}\n']);

    await expect(collect()).resolves.toEqual([expect.objectContaining({ type: "done" })]);
  });
});
