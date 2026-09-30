import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as hub from "@formbricks/hub";
import type { FeedbackRecordCreateParams } from "@/modules/hub/types";

/**
 * The retry policy, driven through the real SDK.
 *
 * The generated client has no retries of its own; `hub-client.ts` supplies them as a custom `fetch`
 * (`hub-fetch.ts`). Nothing in the type system says that `fetch` is still the one the client calls, so
 * these leave the SDK real and stub only the global transport underneath it: the assertion is on the
 * number of requests actually attempted for a real generated operation.
 */
vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: { HUB_API_KEY: "test-key", HUB_API_URL: "https://hub.test" },
}));

const globalForHub = globalThis as unknown as { formbricksHubHeyApiClient: unknown };

const record = { tenant_id: "t1", submission_id: "s1", field_id: "q1" } as FeedbackRecordCreateParams;

/**
 * A stub transport answering with one RFC 9457 problem body.
 *
 * `code` is the member the narrowing reads, so it is a parameter rather than part of a fixed body:
 * on a 409 it is the entire difference between the duplicate row and a draining tenant purge.
 *
 * `retry-after-ms: 0` is honoured ahead of the exponential backoff, so a retrying case costs no wall
 * clock here. Without it the 429 test would sleep ~1.5s to prove the same thing.
 */
const respondWith = (status: number, code?: string) => {
  const fetchStub = vi.fn(
    async (_request: Request) =>
      new Response(JSON.stringify({ detail: "stubbed", ...(code ? { code } : {}) }), {
        status,
        headers: { "content-type": "application/problem+json", "retry-after-ms": "0" },
      })
  );
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
};

const getClient = async () => {
  const { getHubClient } = await import("./hub-client");
  const client = getHubClient();
  if (!client) throw new Error("expected a client");
  return client;
};

describe("Hub client retries, through the SDK's real request path", () => {
  beforeEach(() => {
    vi.resetModules();
    globalForHub.formbricksHubHeyApiClient = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("a create that hits the duplicate row is attempted once, not three times", async () => {
    const fetchStub = respondWith(409, "conflict");
    const client = await getClient();

    await expect(
      hub.createFeedbackRecord({ client, body: record, throwOnError: true })
    ).rejects.toMatchObject({ status: 409 });

    // The behaviour the narrowing exists for: on a re-import every create conflicts, and the default
    // policy is three POSTs plus ~1.5s of backoff per record for an answer that cannot change.
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  test("a create refused by a draining tenant purge is still retried", async () => {
    const fetchStub = respondWith(409, "tenant_write_conflict");
    const client = await getClient();

    await expect(
      hub.createFeedbackRecord({ client, body: record, throwOnError: true })
    ).rejects.toMatchObject({ status: 409 });

    // Hub's create answers 409 for two unrelated reasons and documents this one as retryable
    // (`openapi.yaml`, and `NewTenantWriteConflictError` in its feedback-records repository).
    // Keying the narrowing on the status or the path alone suppressed a retry Hub asked for.
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a conflicting create whose body carries no code falls back to the default policy", async () => {
    const fetchStub = respondWith(409);
    const client = await getClient();

    await expect(
      hub.createFeedbackRecord({ client, body: record, throwOnError: true })
    ).rejects.toMatchObject({ status: 409 });

    // Nothing to read the two 409s apart with, so the degradation is the safe one: the extra
    // retries the policy would have made anyway, never a suppressed one.
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a rate-limited create is still retried", async () => {
    const fetchStub = respondWith(429);
    const client = await getClient();

    await expect(
      hub.createFeedbackRecord({ client, body: record, throwOnError: true })
    ).rejects.toMatchObject({ status: 429 });

    // One attempt plus two retries. This is what a blanket "never retry creates" would have cost us
    // on the highest-volume write path in the app.
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a 409 outside the feedback-record collection is still retried", async () => {
    const fetchStub = respondWith(409, "tenant_write_conflict");
    const client = await getClient();

    await expect(
      hub.patchTenantSettings({ client, path: { tenant_id: "tenant-1" }, body: {}, throwOnError: true })
    ).rejects.toMatchObject({ status: 409 });

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  // The collection path also serves the delete-by-user bulk delete. Only the create's duplicate is
  // terminal; the narrowing keys on the request's method to keep it that way.
  test("a duplicate-coded 409 on the collection that is not a create is still retried", async () => {
    const fetchStub = respondWith(409, "conflict");
    const client = await getClient();

    await expect(
      hub.deleteFeedbackRecordsByUser({ client, query: { user_id: "u1" }, throwOnError: true })
    ).rejects.toMatchObject({ status: 409 });

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a 409 on a single record is still retried", async () => {
    const fetchStub = respondWith(409, "conflict");
    const client = await getClient();

    // `/v1/feedback-records/{id}` is not the collection path the create posts to.
    await expect(
      hub.updateFeedbackRecord({
        client,
        path: { id: "rec-1" },
        body: { value_text: "x" },
        throwOnError: true,
      })
    ).rejects.toMatchObject({ status: 409 });

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });
});
