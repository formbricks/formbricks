import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHubFetch } from "./hub-fetch";

/**
 * The transport's mechanics, driven directly: how long it waits, what it gives up on, and that each
 * attempt is a complete request. Which statuses are retried end to end, through the real client, lives
 * in `hub-client-retry.test.ts`.
 */

const URL_UNDER_TEST = "https://hub.test/v1/feedback-records";

/** A fresh response per call: a body can be read once, and each attempt gets its own. */
type TStubAnswer = () => Response;

const problem =
  (status: number, headers: Record<string, string> = {}): TStubAnswer =>
  () =>
    new Response(JSON.stringify({ detail: "stubbed" }), {
      status,
      headers: { "content-type": "application/problem+json", ...headers },
    });

const ok: TStubAnswer = () => new Response("{}");

/** Answers each attempt with the next entry; the last one repeats. */
const stubFetch = (...answers: Array<TStubAnswer | Error>) => {
  const fetchStub = vi.fn(async (_request: Request) => {
    const next = answers.length > 1 ? answers.shift()! : answers[0];
    if (next instanceof Error) throw next;
    return next();
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createHubFetch", () => {
  test("sends the full request body on every attempt", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        bodies.push(await request.text());
        return problem(503, { "retry-after-ms": "0" })();
      })
    );

    await createHubFetch()(URL_UNDER_TEST, { method: "POST", body: '{"field_id":"q1"}' });

    // A Request body is a one-shot stream: a retry that re-sent the same object would go out empty.
    expect(bodies).toEqual(['{"field_id":"q1"}', '{"field_id":"q1"}', '{"field_id":"q1"}']);
  });

  test("returns the final failed response unread, so the client can report it", async () => {
    stubFetch(problem(503, { "retry-after-ms": "0" }));

    const response = await createHubFetch()(URL_UNDER_TEST);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ detail: "stubbed" });
  });

  describe("waiting between attempts", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    test("backs off exponentially when the server names no wait", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // no jitter
      const fetchStub = stubFetch(problem(503));

      const pending = createHubFetch()(URL_UNDER_TEST);

      await vi.advanceTimersByTimeAsync(499);
      expect(fetchStub).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchStub).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(999);
      expect(fetchStub).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchStub).toHaveBeenCalledTimes(3);

      await expect(pending).resolves.toHaveProperty("status", 503);
    });

    test("waits as long as Retry-After asks, in seconds", async () => {
      const fetchStub = stubFetch(problem(429, { "retry-after": "2" }), ok);

      const pending = createHubFetch()(URL_UNDER_TEST);

      await vi.advanceTimersByTimeAsync(1999);
      expect(fetchStub).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toHaveProperty("status", 200);
      expect(fetchStub).toHaveBeenCalledTimes(2);
    });

    test("reads an HTTP-date Retry-After, and one in the past means now", async () => {
      const fetchStub = stubFetch(problem(429, { "retry-after": new Date(0).toUTCString() }), ok);

      const pending = createHubFetch()(URL_UNDER_TEST);
      await vi.advanceTimersByTimeAsync(0);

      await expect(pending).resolves.toHaveProperty("status", 200);
      expect(fetchStub).toHaveBeenCalledTimes(2);
    });

    test("gives up rather than wait longer than a minute", async () => {
      const fetchStub = stubFetch(problem(429, { "retry-after": "120" }));

      const response = await createHubFetch()(URL_UNDER_TEST);

      // Retrying sooner would be a request the server already said it will refuse.
      expect(response.status).toBe(429);
      expect(fetchStub).toHaveBeenCalledTimes(1);
    });

    test("retries a connection failure, and surfaces it once the retries run out", async () => {
      const failure = new TypeError("fetch failed");
      const fetchStub = stubFetch(failure);

      const pending = createHubFetch()(URL_UNDER_TEST);
      const settled = expect(pending).rejects.toBe(failure);
      await vi.runAllTimersAsync();

      await settled;
      expect(fetchStub).toHaveBeenCalledTimes(3);
    });

    test("stops waiting as soon as the caller aborts", async () => {
      const fetchStub = stubFetch(problem(503, { "retry-after": "5" }));
      const controller = new AbortController();

      const pending = createHubFetch()(URL_UNDER_TEST, { signal: controller.signal });
      const settled = expect(pending).rejects.toHaveProperty("name", "AbortError");
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();

      await settled;
      expect(fetchStub).toHaveBeenCalledTimes(1);
    });
  });

  test("does not retry a request the caller aborted, and rethrows fetch's own error", async () => {
    const controller = new AbortController();
    const aborted = new DOMException("This operation was aborted", "AbortError");
    const fetchStub = vi.fn(async () => {
      controller.abort();
      throw aborted;
    });
    vi.stubGlobal("fetch", fetchStub);

    await expect(createHubFetch()(URL_UNDER_TEST, { signal: controller.signal })).rejects.toBe(aborted);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  test("times out an attempt that never answers, then retries it", async () => {
    const signals: AbortSignal[] = [];
    const fetchStub = vi.fn(async (request: Request) => {
      signals.push(request.signal);
      if (signals.length > 1) return new Response("{}");
      // Hang until aborted, like a Hub that accepted the connection and went silent.
      return new Promise<Response>((_, reject) => {
        request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchStub);

    const response = await createHubFetch({ timeoutMs: 20 })(URL_UNDER_TEST);

    expect(response.status).toBe(200);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(signals[0].reason).toHaveProperty("name", "TimeoutError");
  });

  test("obeys an explicit x-should-retry either way", async () => {
    const neverRetry = stubFetch(problem(503, { "x-should-retry": "false" }));
    await createHubFetch()(URL_UNDER_TEST);
    expect(neverRetry).toHaveBeenCalledTimes(1);

    const alwaysRetry = stubFetch(problem(400, { "x-should-retry": "true", "retry-after-ms": "0" }));
    await createHubFetch()(URL_UNDER_TEST);
    expect(alwaysRetry).toHaveBeenCalledTimes(3);
  });

  test("does not retry a client error", async () => {
    const fetchStub = stubFetch(problem(400, { "retry-after-ms": "0" }));

    await createHubFetch()(URL_UNDER_TEST);

    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});
