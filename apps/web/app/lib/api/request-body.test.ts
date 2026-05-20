import { describe, expect, test } from "vitest";
import {
  DEFAULT_REQUEST_BODY_LIMIT_BYTES,
  RequestBodyTooLargeError,
  parseJsonBodyWithLimit,
  readRequestBodyWithLimit,
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
