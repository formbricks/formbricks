import { afterEach, describe, expect, test, vi } from "vitest";
import {
  QSF_IMPORT_STREAM_ENDPOINT,
  QsfImportRequestError,
  parseRetryAfterSeconds,
  streamQsfImport,
} from "./import-stream-client";

const body = { workspaceId: "clxx1234567890123456789012", fileName: "survey.qsf", qsf: { SurveyEntry: {} } };

const collect = async () => {
  const events: unknown[] = [];
  await streamQsfImport(body, {
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event),
  });
  return events;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseRetryAfterSeconds", () => {
  test.each([
    ["15", 15],
    ["0", 0],
    [null, null],
    ["", null],
    ["-1", null],
    ["1.5", null],
    ["Wed, 21 Oct 2026 07:28:00 GMT", null],
  ])("reads %s as %s", (header, seconds) => {
    expect(parseRetryAfterSeconds(header)).toBe(seconds);
  });
});

describe("streamQsfImport", () => {
  test("posts the parsed file as JSON and hands over each event", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"type":"start","requestId":"r1"}\n{"type":"done","payload":{},"report":{}}\n', {
          headers: { "Content-Type": "application/x-ndjson" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await collect()).toEqual([
      { type: "start", requestId: "r1" },
      { type: "done", payload: {}, report: {} },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      QSF_IMPORT_STREAM_ENDPOINT,
      expect.objectContaining({ method: "POST", body: JSON.stringify(body) })
    );
  });

  test("throws a refusal with its problem code and Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 429, detail: "wait", code: "concurrency_limit_reached" }), {
            status: 429,
            headers: { "Content-Type": "application/problem+json", "Retry-After": "15" },
          })
      )
    );

    const error = await collect().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(QsfImportRequestError);
    expect(error).toMatchObject({ status: 429, code: "concurrency_limit_reached", retryAfterSeconds: 15 });
  });

  test("fails a stream that ends without done or error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"type":"progress","stage":"ai"}\n'))
    );

    await expect(collect()).rejects.toThrow(/without a result/);
  });
});
