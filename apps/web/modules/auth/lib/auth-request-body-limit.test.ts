import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  AUTH_REQUEST_BODY_LIMIT_BYTES,
  isAuthRequestBodyLimited,
  withAuthRequestBodyLimit,
} from "./auth-request-body-limit";

const LIMIT = AUTH_REQUEST_BODY_LIMIT_BYTES;

const ok = (_request?: Request) => new Response("ok", { status: 200 });

/** A POST whose body streams in `chunkBytes` pieces with no Content-Length, like a chunked upload. */
const chunkedRequest = (totalBytes: number, chunkBytes = 16 * 1024, headers: HeadersInit = {}) => {
  let sent = 0;
  const state = { pulls: 0, cancelled: false };
  const request = new Request("http://localhost/api/auth/sign-in/email", {
    method: "POST",
    headers,
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        state.pulls += 1;
        const size = Math.min(chunkBytes, totalBytes - sent);
        if (size === 0) return controller.close();
        sent += size;
        controller.enqueue(new Uint8Array(size).fill(97));
      },
      cancel() {
        state.cancelled = true;
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, state };
};

describe("withAuthRequestBodyLimit", () => {
  test("answers 413 from the declared Content-Length without reading the body", async () => {
    const handler = vi.fn(ok);
    const { request, state } = chunkedRequest(LIMIT + 1, 1024, { "content-length": String(LIMIT + 1) });

    const response = await withAuthRequestBodyLimit(handler)(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "payload_too_large",
      error_description: `Request body must not exceed ${LIMIT} bytes`,
      code: "PAYLOAD_TOO_LARGE",
      message: `Request body must not exceed ${LIMIT} bytes`,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(handler).not.toHaveBeenCalled();
    // A ReadableStream primes one pull on construction; the guard itself must not read any further.
    expect(state.pulls).toBeLessThanOrEqual(1);
  });

  test("answers 413 for a chunked body with no Content-Length, and stops reading at the limit", async () => {
    const handler = vi.fn(ok);
    // 64 MB offered; the guard has to stop long before the source runs dry.
    const { request, state } = chunkedRequest(64 * 1024 * 1024);

    const response = await withAuthRequestBodyLimit(handler)(request);

    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
    expect(state.cancelled).toBe(true);
    expect(state.pulls).toBeLessThan(LIMIT / (16 * 1024) + 3);
  });

  test("answers 413 when Content-Length understates the body", async () => {
    const handler = vi.fn(ok);
    const { request } = chunkedRequest(LIMIT + 1, 1024, { "content-length": "10" });

    expect((await withAuthRequestBodyLimit(handler)(request)).status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  test("ignores a Content-Length that is not a number and counts the stream instead", async () => {
    const handler = vi.fn(ok);
    const { request } = chunkedRequest(LIMIT + 1, 1024, { "content-length": "not-a-number" });

    expect((await withAuthRequestBodyLimit(handler)(request)).status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  test("accepts a body of exactly the limit and hands the handler the same bytes", async () => {
    const body = new Uint8Array(LIMIT).fill(98);
    const seen = vi.fn(async (request: Request) => new Response(await request.arrayBuffer()));
    const request = new Request("http://localhost/api/auth/oauth2/register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-trace": "keep-me" },
      body,
    });

    const response = await withAuthRequestBodyLimit(seen)(request);

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
    const forwarded = seen.mock.calls[0][0];
    expect(forwarded.url).toBe("http://localhost/api/auth/oauth2/register");
    expect(forwarded.method).toBe("POST");
    expect(forwarded.headers.get("x-trace")).toBe("keep-me");
  });

  test("accepts a body of exactly the limit that arrives in several chunks", async () => {
    const seen = vi.fn(async (request: Request) =>
      Response.json({ bytes: (await request.arrayBuffer()).byteLength })
    );
    const { request } = chunkedRequest(LIMIT, 10_000);

    const response = await withAuthRequestBodyLimit(seen)(request);

    expect(await response.json()).toEqual({ bytes: LIMIT });
  });

  test("hands over a body that parses as the form or multipart post it was", async () => {
    const seen = vi.fn(async (request: Request) => {
      const form = await request.formData();
      return Response.json(Object.fromEntries(form.entries()));
    });
    const urlencoded = new Request("http://localhost/api/auth/saml/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=abc%20def",
    });
    const multipartBody = new FormData();
    multipartBody.set("SAMLResponse", "PHNhbWw+");
    const multipart = new Request("http://localhost/api/auth/saml/callback", {
      method: "POST",
      body: multipartBody,
    });

    expect(await (await withAuthRequestBodyLimit(seen)(urlencoded)).json()).toEqual({
      grant_type: "authorization_code",
      code: "abc def",
    });
    expect(await (await withAuthRequestBodyLimit(seen)(multipart)).json()).toEqual({
      SAMLResponse: "PHNhbWw+",
    });
  });

  test("drops the framing headers that described the stream it consumed", async () => {
    const seen = vi.fn(async (_request: Request) => ok());
    const { request } = chunkedRequest(1024, 512, {
      "content-length": "1024",
      "transfer-encoding": "chunked",
      "x-keep": "yes",
    });

    await withAuthRequestBodyLimit(seen)(request);

    const forwarded = seen.mock.calls[0][0];
    expect(forwarded.headers.has("content-length")).toBe(false);
    expect(forwarded.headers.has("transfer-encoding")).toBe(false);
    expect(forwarded.headers.get("x-keep")).toBe("yes");
  });

  test("rejects one byte over the limit", async () => {
    const handler = vi.fn(ok);
    const request = new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      body: new Uint8Array(LIMIT + 1),
    });

    expect((await withAuthRequestBodyLimit(handler)(request)).status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  test("passes a request without a body through untouched", async () => {
    const handler = vi.fn(ok);
    const get = new Request("http://localhost/api/auth/get-session");
    const emptyPost = new Request("http://localhost/api/auth/sign-out", { method: "POST" });

    await withAuthRequestBodyLimit(handler)(get);
    await withAuthRequestBodyLimit(handler)(emptyPost);

    expect(handler.mock.calls[0][0]).toBe(get);
    expect(handler.mock.calls[1][0]).toBe(emptyPost);
  });

  test("forwards the route context argument, with and without a body", async () => {
    const handler = vi.fn((_request: Request, _context: { params: Promise<{ all: string[] }> }) => ok());
    const context = { params: Promise.resolve({ all: ["get-session"] }) };
    const wrapped = withAuthRequestBodyLimit(handler);

    await wrapped(new Request("http://localhost/api/auth/get-session"), context);
    await wrapped(
      new Request("http://localhost/api/auth/sign-in/email", { method: "POST", body: "{}" }),
      context
    );

    expect(handler.mock.calls[0][1]).toBe(context);
    expect(handler.mock.calls[1][1]).toBe(context);
  });

  test("carries the abort signal, so a client disconnect still cancels the handler", async () => {
    const seen = vi.fn(async (_request: Request) => ok());
    const controller = new AbortController();
    const request = new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      body: "{}",
      signal: controller.signal,
    });

    await withAuthRequestBodyLimit(seen)(request);
    const forwarded = seen.mock.calls[0][0];
    expect(forwarded).not.toBe(request);
    expect(forwarded.signal.aborted).toBe(false);

    controller.abort();
    expect(forwarded.signal.aborted).toBe(true);
  });

  test("keeps a NextRequest a NextRequest when it rebuilds the body", async () => {
    const seen = vi.fn(async (request: NextRequest) => Response.json({ path: request.nextUrl.pathname }));
    const request = new NextRequest("http://localhost/api/auth/saml/token?x=1", {
      method: "POST",
      body: "grant_type=authorization_code",
    });

    const response = await withAuthRequestBodyLimit(seen)(request);

    expect(await response.json()).toEqual({ path: "/api/auth/saml/token" });
    expect(seen.mock.calls[0][0]).toBeInstanceOf(NextRequest);
  });

  test("lets an error thrown by the handler propagate unchanged", async () => {
    const boom = new Error("boom");
    const request = new Request("http://localhost/api/auth/x", { method: "POST", body: "{}" });

    await expect(
      withAuthRequestBodyLimit(() => {
        throw boom;
      })(request)
    ).rejects.toBe(boom);
  });

  /** A POST whose body fails mid-read with `error`, as Node's does when the client disconnects. */
  const failingRequest = (error: Error, signal?: AbortSignal) =>
    new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      signal,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(1024));
        },
        pull(controller) {
          // Only after the first chunk has been read, so the failure lands mid-upload.
          if (controller.desiredSize !== null && controller.desiredSize > 0) controller.error(error);
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

  test.each([
    ["Node's ECONNRESET", Object.assign(new Error("aborted"), { code: "ECONNRESET" }), undefined],
    ["an aborted request signal", new Error("terminated"), AbortSignal.abort()],
  ])("answers a client that disconnects mid-upload (%s) with a bare 400", async (_name, error, signal) => {
    const handler = vi.fn(ok);

    const response = await withAuthRequestBodyLimit(handler)(failingRequest(error, signal));

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  test("lets any other body read error propagate", async () => {
    const boom = new Error("read failed");

    await expect(withAuthRequestBodyLimit(vi.fn(ok))(failingRequest(boom))).rejects.toBe(boom);
  });

  test("marks what it wraps, and only that", () => {
    expect(isAuthRequestBodyLimited(withAuthRequestBodyLimit(ok))).toBe(true);
    expect(isAuthRequestBodyLimited(ok)).toBe(false);
    expect(isAuthRequestBodyLimited(undefined)).toBe(false);
  });
});

/** Next's `proxyClientMaxBodySize` from `next.config.mjs`, in bytes (Next counts `mb` as 1024²). */
const readProxyClientMaxBodySize = (): number => {
  const config = readFileSync(path.resolve(__dirname, "../../../next.config.mjs"), "utf8");
  const match = /proxyClientMaxBodySize:\s*["'](\d+)(b|kb|mb|gb)["']/i.exec(config);
  if (!match) throw new Error("proxyClientMaxBodySize not found in next.config.mjs");

  const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Number(match[1]) * units[match[2].toLowerCase()];
};

describe("AUTH_REQUEST_BODY_LIMIT_BYTES", () => {
  test("stays below Next's proxy buffer, which truncates a body instead of refusing it", () => {
    // A body the proxy cut at its ceiling is still over this limit, so it is refused here rather than
    // reaching a handler as a silently truncated payload.
    expect(LIMIT).toBeLessThan(readProxyClientMaxBodySize());
    expect(Number.isSafeInteger(LIMIT)).toBe(true);
  });
});
