import { describe, expect, test } from "vitest";
import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  RequestBodyTooLargeError,
  parseFormDataWithLimit,
  parseJsonBodyWithLimit,
  readRequestBodyWithLimit,
  readRequestBytesWithLimit,
} from "./request-body";

const createStreamingRequest = (chunks: string[]): Request =>
  new Request("http://localhost/api/test", {
    method: "POST",
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });

describe("request body parsing", () => {
  test("rejects a request when content-length exceeds the body limit", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Length": String(DEFAULT_REQUEST_BODY_LIMIT_BYTES + 1),
      },
      body: "{}",
    });

    await expect(readRequestBodyWithLimit(request)).rejects.toMatchObject({
      actualBytes: DEFAULT_REQUEST_BODY_LIMIT_BYTES + 1,
      limitBytes: DEFAULT_REQUEST_BODY_LIMIT_BYTES,
      name: "RequestBodyTooLargeError",
    });
  });

  test("rejects a streamed request when the actual body exceeds the body limit", async () => {
    const request = createStreamingRequest(["a".repeat(DEFAULT_REQUEST_BODY_LIMIT_BYTES), "b"]);

    await expect(readRequestBodyWithLimit(request)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  test("allows a body exactly at the body limit", async () => {
    const rawBody = "a".repeat(DEFAULT_REQUEST_BODY_LIMIT_BYTES);
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: rawBody,
    });

    const body = await readRequestBodyWithLimit(request);

    expect(body).toHaveLength(DEFAULT_REQUEST_BODY_LIMIT_BYTES);
    expect(body).toBe(rawBody);
  });

  test("preserves JSON parse errors for malformed bodies under the body limit", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: "{invalid-json",
    });

    await expect(parseJsonBodyWithLimit(request)).rejects.toBeInstanceOf(SyntaxError);
  });

  test("returns an empty string for requests without a body", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
    });

    await expect(readRequestBodyWithLimit(request)).resolves.toBe("");
  });
});

describe("readRequestBytesWithLimit", () => {
  test("returns the bytes untouched, including ones that are not valid UTF-8", async () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x80]);
    const request = new Request("http://localhost/api/test", { method: "POST", body: bytes });

    expect(await readRequestBytesWithLimit(request)).toEqual(bytes);
  });

  test("returns an empty array for a request without a body", async () => {
    const request = new Request("http://localhost/api/test", { method: "POST" });

    expect(await readRequestBytesWithLimit(request)).toEqual(new Uint8Array(0));
  });

  test("joins a body that arrives in several chunks", async () => {
    const request = createStreamingRequest(["ab", "cd", "ef"]);

    expect(new TextDecoder().decode(await readRequestBytesWithLimit(request))).toBe("abcdef");
  });

  test("stops reading a stream the moment it passes the limit", async () => {
    const chunk = new Uint8Array(1024);
    let pulls = 0;
    let cancelled = false;
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          controller.enqueue(chunk);
        },
        cancel() {
          cancelled = true;
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readRequestBytesWithLimit(request, 4096)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancelled).toBe(true);
    // Five 1 KiB chunks cross a 4 KiB limit; an unbounded reader would never return from this source.
    expect(pulls).toBeLessThanOrEqual(6);
  });
});

describe("parseFormDataWithLimit", () => {
  test("parses fields and files exactly as formData() would", async () => {
    const form = new FormData();
    form.set("workspaceId", "workspace_1");
    form.set("file", new File(["value\nexample"], "feedback.csv", { type: "text/csv" }));
    const request = new Request("http://localhost/api/test", { method: "POST", body: form });

    const parsed = await parseFormDataWithLimit(request, 64 * 1024);
    const file = parsed.get("file");

    expect(parsed.get("workspaceId")).toBe("workspace_1");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("feedback.csv");
    expect(await (file as File).text()).toBe("value\nexample");
  });

  test("refuses a multipart stream with no length once it passes the limit, without reading it whole", async () => {
    let pulls = 0;
    let cancelled = false;
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          if (pulls === 64) return controller.close();
          pulls += 1;
          controller.enqueue(new Uint8Array(1024));
        },
        cancel() {
          cancelled = true;
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(parseFormDataWithLimit(request, 4096)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(6);
  });

  test("fails like formData() on a body that is not form data", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    await expect(parseFormDataWithLimit(request)).rejects.toBeInstanceOf(TypeError);
  });
});
