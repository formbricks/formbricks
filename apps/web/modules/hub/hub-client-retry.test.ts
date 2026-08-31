import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FeedbackRecordCreateParams } from "@/modules/hub/types";

/**
 * The retry narrowing, driven through the real SDK.
 *
 * `hub-client.test.ts` mocks `@formbricks/hub`, which is the right shape for the `getHubClient`
 * caching tests but replaces the very thing this behaviour depends on: that the SDK's request loop
 * calls `shouldRetry` and honours a `false`. `shouldRetry` is `private` in the SDK's types, so the
 * override is installed on the prototype — nothing in the type system says it is still wired up.
 * This file therefore leaves the SDK real and stubs only the transport, so the assertion is on the
 * number of POSTs actually attempted.
 *
 * The same reasoning as `assertRepeatedArrayParams`: an SDK release that renames or stops calling
 * the hook is legal TypeScript and silently restores the retry storm.
 */
vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: { HUB_API_KEY: "test-key", HUB_API_URL: "https://hub.test" },
}));

const globalForHub = globalThis as unknown as { formbricksHubClientRepeatArrays: unknown };

const record = { tenant_id: "t1", submission_id: "s1", field_id: "q1" } as FeedbackRecordCreateParams;

/**
 * `retry-after-ms: 0` is honoured ahead of the SDK's exponential backoff, so a retrying case costs
 * no wall clock here. Without it the 429 test would sleep ~1.5s to prove the same thing.
 */
const respondWith = (status: number): typeof fetch =>
  vi.fn(async (input: RequestInfo | URL) => {
    const response = new Response(JSON.stringify({ detail: "stubbed" }), {
      status,
      headers: { "content-type": "application/json", "retry-after-ms": "0" },
    });
    // A hand-built `Response` has an empty `url`; a real fetch populates it from the request, which
    // is what the narrowing reads to tell the create apart from the other operations on this path.
    Object.defineProperty(response, "url", {
      value: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    });
    return response;
  }) as unknown as typeof fetch;

const getClient = async () => {
  const { getHubClient } = await import("./hub-client");
  const client = getHubClient();
  if (!client) throw new Error("expected a client");
  return client;
};

describe("Hub client retries, through the SDK's own request loop", () => {
  beforeEach(() => {
    vi.resetModules();
    globalForHub.formbricksHubClientRepeatArrays = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("a create that conflicts is attempted once, not three times", async () => {
    const fetchStub = respondWith(409);
    vi.stubGlobal("fetch", fetchStub);
    const client = await getClient();

    await expect(client.feedbackRecords.create(record)).rejects.toThrow();

    // The behaviour the narrowing exists for: on a re-import every create conflicts, and the SDK's
    // default is three POSTs plus ~1.5s of backoff per record for an answer that cannot change.
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  test("a rate-limited create still gets the SDK's retries", async () => {
    const fetchStub = respondWith(429);
    vi.stubGlobal("fetch", fetchStub);
    const client = await getClient();

    await expect(client.feedbackRecords.create(record)).rejects.toThrow();

    // maxRetries defaults to 2, so one attempt plus two retries. This is what a per-request
    // `maxRetries: 0` would have cost us on the highest-volume write path in the app.
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a 409 outside the feedback-record collection is still retried", async () => {
    const fetchStub = respondWith(409);
    vi.stubGlobal("fetch", fetchStub);
    const client = await getClient();

    // Hub's `tenant_write_conflict` is a genuinely retryable 409 (a tenant purge is draining), which
    // is why the narrowing is scoped to the create rather than to the status.
    await expect(client.tenants.settings.update("tenant-1", {})).rejects.toThrow();

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  // The narrowing reads `response.url`, which a real fetch always populates. Pinning what happens
  // when it is absent so the degradation is a decision rather than a surprise: the SDK's own policy
  // stands, which costs the extra retries but never suppresses one that was wanted.
  test("a conflict whose response carries no URL falls back to the SDK's policy", async () => {
    const fetchStub = vi.fn(
      async () => new Response("{}", { status: 409, headers: { "retry-after-ms": "0" } })
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchStub);
    const client = await getClient();

    await expect(client.feedbackRecords.create(record)).rejects.toThrow();

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a 409 on a single record is still retried", async () => {
    const fetchStub = respondWith(409);
    vi.stubGlobal("fetch", fetchStub);
    const client = await getClient();

    // `/v1/feedback-records/{id}` is not the collection path the create posts to.
    await expect(client.feedbackRecords.update("rec-1", { value_text: "x" })).rejects.toThrow();

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });
});
