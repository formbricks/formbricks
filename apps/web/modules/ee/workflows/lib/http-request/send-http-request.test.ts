import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type WorkflowHttpCall, sendWorkflowHttpRequest } from "./send-http-request";

const flags = vi.hoisted(() => ({ allowInternal: false, allowPlainHttp: false }));

vi.mock("@/lib/constants", () => ({
  get DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS() {
    return flags.allowInternal;
  },
  get ALLOW_WORKFLOW_PLAIN_HTTP() {
    return flags.allowPlainHttp;
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// An IP literal: the address check runs for real without a DNS lookup.
const PUBLIC_URL = "https://93.184.216.34/hook";

const call = (overrides: Partial<WorkflowHttpCall> = {}): WorkflowHttpCall => ({
  method: "POST",
  url: PUBLIC_URL,
  headers: { "content-type": "application/json", authorization: "Bearer secret" },
  body: '{"a":1}',
  ...overrides,
});

const response = (status: number, body = "", headers: Record<string, string> = {}) =>
  new Response(status === 204 || status === 304 ? null : body, { status, headers });

const stubFetch = (...responses: (Response | Error)[]) => {
  const queue = [...responses];
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const sleep = vi.fn(async (_ms: number) => undefined);

beforeEach(() => {
  flags.allowInternal = false;
  flags.allowPlainHttp = false;
  sleep.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendWorkflowHttpRequest", () => {
  test("sends the call once and returns the response", async () => {
    const fetchMock = stubFetch(response(201, '{"id":"c_1"}', { "content-type": "application/json" }));

    const result = await sendWorkflowHttpRequest(call(), { retries: 3, sleep });

    expect(result).toMatchObject({
      attempts: 1,
      error: null,
      response: { status: 201, contentType: "application/json", bodyText: '{"id":"c_1"}', truncated: false },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("never follows a redirect: the 3xx is the response", async () => {
    const fetchMock = stubFetch(response(302, "", { location: "http://169.254.169.254/" }));
    flags.allowInternal = true; // Even where internal URLs are allowed.

    const result = await sendWorkflowHttpRequest(call(), { retries: 3, sleep });

    expect(result.response?.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  test("retries timeouts, 429 and 5xx three times with growing waits, then gives the last answer", async () => {
    stubFetch(response(503), response(429), new DOMException("timed out", "TimeoutError"), response(500));

    const result = await sendWorkflowHttpRequest(call(), { retries: 3, sleep });

    expect(result.attempts).toBe(4);
    expect(result.response?.status).toBe(500);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1_000, 2_000, 4_000]);
  });

  test("stops retrying at the first answer that is not retryable", async () => {
    const fetchMock = stubFetch(response(503), response(404));

    const result = await sendWorkflowHttpRequest(call(), { retries: 3, sleep });

    expect(result.response?.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("a Send test request (no retries) makes exactly one attempt", async () => {
    const fetchMock = stubFetch(response(503));

    const result = await sendWorkflowHttpRequest(call(), { retries: 0, sleep });

    expect(result.response?.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a timeout with no answer at all reports an error, not a response", async () => {
    stubFetch(new DOMException("timed out", "TimeoutError"));

    const result = await sendWorkflowHttpRequest(call(), { retries: 0, sleep });

    expect(result.response).toBeNull();
    expect(result.error).toMatch(/timed out/i);
  });

  test("refuses a private address unless internal URLs are allowed, and never retries it", async () => {
    const fetchMock = stubFetch(response(200));

    const refused = await sendWorkflowHttpRequest(call({ url: "https://10.0.0.5/hook" }), {
      retries: 3,
      sleep,
    });

    expect(refused).toMatchObject({ response: null, attempts: 1 });
    expect(refused.error).toMatch(/private or internal/);
    expect(fetchMock).not.toHaveBeenCalled();

    flags.allowInternal = true;
    const allowed = await sendWorkflowHttpRequest(call({ url: "https://10.0.0.5/hook" }), {
      retries: 3,
      sleep,
    });
    expect(allowed.response?.status).toBe(200);
  });

  test("refuses plain HTTP unless the instance allows it", async () => {
    const fetchMock = stubFetch(response(200));

    const refused = await sendWorkflowHttpRequest(call({ url: "http://93.184.216.34/hook" }), {
      retries: 3,
      sleep,
    });
    expect(refused.error).toMatch(/HTTPS/);
    expect(fetchMock).not.toHaveBeenCalled();

    flags.allowPlainHttp = true;
    const allowed = await sendWorkflowHttpRequest(call({ url: "http://93.184.216.34/hook" }), {
      retries: 3,
      sleep,
    });
    expect(allowed.response?.status).toBe(200);
  });

  test("reads at most 1 MB of the response and marks it truncated", async () => {
    stubFetch(response(200, "x".repeat(1024 * 1024 + 10), { "content-type": "text/plain" }));

    const result = await sendWorkflowHttpRequest(call(), { retries: 0, sleep });

    expect(result.response?.bodyText).toHaveLength(1024 * 1024);
    expect(result.response?.truncated).toBe(true);
  });
});
