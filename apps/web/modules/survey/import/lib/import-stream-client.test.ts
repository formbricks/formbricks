import { afterEach, describe, expect, test, vi } from "vitest";
import type { TSurveyImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import { buildImportFormData, streamImportConversion } from "./import-stream-client";

const encoder = new TextEncoder();

const respondWith = (chunks: string[]) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const collect = async (formData = new FormData()) => {
  const events: TSurveyImportStreamEvent[] = [];
  await streamImportConversion(formData, {
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event),
  });
  return events;
};

describe("streamImportConversion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts the multipart body to the import stream and delivers progress events", async () => {
    const fetchMock = respondWith([
      '{"type":"start","requestId":"r","source":{"lane":"ai","kind":"docx"}}\n',
      '{"type":"progress","stage":"extracting","chunk":{"index":1,"total":2}}\n{"type":"partial","seq":1,"draft":{},"blockOffset":0}\n',
      '{"type":"future_event","x":1}\n{"type":"done","payload":null,"document":null,"references":null,"validation":{"valid":false,"invalid_params":[]},"report":{"issues":[]}}\n',
    ]);
    const formData = buildImportFormData({
      workspaceId: "w1",
      file: new File(["x"], "s.docx"),
      language: "de-DE",
    });

    const events = await collect(formData);

    expect(events.map((event) => event.type)).toEqual([
      "start",
      "progress",
      "partial",
      "future_event",
      "done",
    ]);
    expect(events[1]).toMatchObject({ stage: "extracting", chunk: { index: 1, total: 2 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/internal/surveys/import/stream");
    expect(init.body).toBe(formData);
    expect(init.headers).toBeUndefined();
    expect(formData.get("workspaceId")).toBe("w1");
    expect(formData.get("language")).toBe("de-DE");
    expect((formData.get("file") as File).name).toBe("s.docx");
  });

  test("a stream that ends without done or error throws", async () => {
    respondWith([
      '{"type":"start","requestId":"r","source":{"lane":"ai","kind":"pdf"}}\n{"type":"progress","stage":"reading"}\n',
    ]);
    await expect(collect()).rejects.toThrow("ended without a result");
  });
});
