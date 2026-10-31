import { afterEach, describe, expect, test, vi } from "vitest";
import {
  SURVEY_IMPORT_STREAM_ENDPOINT,
  SurveyImportRequestError,
  parseRetryAfterSeconds,
  streamSurveyImportFile,
} from "./import-stream-client";

const workspaceId = "clxx1234567890123456789012";
const file = new File(['{"SurveyEntry":{}}'], "survey.qsf", { type: "application/octet-stream" });

const collect = async () => {
  const events: unknown[] = [];
  await streamSurveyImportFile(
    { workspaceId, file },
    {
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event),
    }
  );
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

describe("streamSurveyImportFile", () => {
  test("uploads the file as it is, in a multipart form with the workspace, and hands over each event", async () => {
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe(SURVEY_IMPORT_STREAM_ENDPOINT);
    expect(init.method).toBe("POST");
    // No Content-Type of our own: the browser sets multipart/form-data with its boundary.
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect([...form.keys()]).toEqual(["workspaceId", "file"]);
    expect(form.get("workspaceId")).toBe(workspaceId);
    expect(form.get("file")).toBe(file);
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

    expect(error).toBeInstanceOf(SurveyImportRequestError);
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
