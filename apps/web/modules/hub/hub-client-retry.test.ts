import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as hub from "@formbricks/hub";
import type { FeedbackRecordCreateParams } from "@/modules/hub/types";

/**
 * What the Hub client this app builds retries, driven through the real SDK.
 *
 * The policy is the SDK's (`createHubClient`), not ours. What these pin is that `getHubClient` still gets
 * it — a client assembled any other way gets a bare `fetch` and retries nothing — and the outcomes this
 * app depends on: a re-import must not pay three POSTs per duplicate, and a create must never be re-sent
 * after a failure that may already have stored it. Only the global transport is stubbed, so the assertion is on
 * the number of requests that would actually leave the process.
 */
vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: { HUB_API_KEY: "test-key", HUB_API_URL: "https://hub.test" },
}));

const globalForHub = globalThis as unknown as { formbricksHubHeyApiClient: unknown };

const record = { tenant_id: "t1", submission_id: "s1", field_id: "q1" } as FeedbackRecordCreateParams;

/**
 * A stub transport answering every attempt with one RFC 9457 problem body.
 *
 * `code` is a parameter because on a 409 it is the entire difference between the duplicate row and a
 * draining tenant purge. `Retry-After: 0` keeps a retrying case free of backoff wall clock; on a 503 it
 * is also what marks the refusal as deliberate, so those cases pass headers explicitly.
 */
const respondWith = (
  status: number,
  { code, headers = { "retry-after": "0" } }: { code?: string; headers?: Record<string, string> } = {}
) => {
  const fetchStub = vi.fn(
    async (_request: Request) =>
      new Response(JSON.stringify({ detail: "stubbed", ...(code ? { code } : {}) }), {
        status,
        headers: { "content-type": "application/problem+json", ...headers },
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

const create = async () =>
  hub.createFeedbackRecord({ client: await getClient(), body: record, throwOnError: true });

describe("Hub client retries, through the SDK's real request path", () => {
  beforeEach(() => {
    vi.resetModules();
    globalForHub.formbricksHubHeyApiClient = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("a create that hits the duplicate row is attempted once, not three times", async () => {
    const fetchStub = respondWith(409, { code: "conflict" });

    await expect(create()).rejects.toMatchObject({ status: 409 });

    // On a re-import every create conflicts (`reconcile.ts`); retrying an answer that cannot change was
    // measured at 3x the requests and ~100x the wall clock.
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  test("a create refused by a draining tenant purge is retried", async () => {
    const fetchStub = respondWith(409, { code: "tenant_write_conflict" });

    await expect(create()).rejects.toMatchObject({ status: 409 });

    // Hub documents this 409 as retryable on the create itself; suppressing it would turn a transient
    // purge into a failed record.
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a rate-limited create is retried", async () => {
    const fetchStub = respondWith(429);

    await expect(create()).rejects.toMatchObject({ status: 429 });

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  // The Hub has no idempotency keys, so after a 500 the record may already be stored. Re-sending it would
  // come back as a 409 conflict, reporting a record that was saved as failed. The Stainless SDK did re-send
  // here; the caller now decides.
  test("a create that fails with a 500 is not re-sent", async () => {
    const fetchStub = respondWith(500);

    await expect(create()).rejects.toMatchObject({ status: 500 });

    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  // A proxy in front of the Hub (Envoy, Istio) answers 503 when the upstream resets, which can be after
  // the write committed — so a bare 503 is as ambiguous as a 500 for a create.
  test("a create that gets a 503 without Retry-After is not re-sent", async () => {
    const fetchStub = respondWith(503, { headers: {} });

    await expect(create()).rejects.toMatchObject({ status: 503 });

    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  // Envoy answers 408 when its stream idle timeout fires after forwarding, so a bare 408 is as ambiguous
  // as a bare 503.
  test("a create that gets a 408 without Retry-After is not re-sent", async () => {
    const fetchStub = respondWith(408, { headers: {} });

    await expect(create()).rejects.toMatchObject({ status: 408 });

    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  test("a create that gets a 503 with Retry-After is retried, since the Hub refused it outright", async () => {
    const fetchStub = respondWith(503, { headers: { "retry-after": "0" } });

    await expect(create()).rejects.toMatchObject({ status: 503 });

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  test("a read that fails with a 500 is retried, since re-sending it cannot write anything", async () => {
    const fetchStub = respondWith(500);
    const client = await getClient();

    await expect(
      hub.getFeedbackRecord({ client, path: { id: "rec-1" }, throwOnError: true })
    ).rejects.toMatchObject({ status: 500 });

    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  // Next.js's server `fetch` tees a GET's response body and keeps one branch for its data cache. Cancelling
  // the other branch only settles once the cached one is drained, so a retry that waited on that cancel
  // hung forever — on the one runtime this client actually runs under.
  test("a read retried through a body-teeing fetch, as Next's is, completes", async () => {
    const cachedBranches: ReadableStream[] = [];
    let attempt = 0;
    const fetchStub = vi.fn(async (_request: Request) => {
      attempt++;
      const upstream =
        attempt === 1
          ? new Response(JSON.stringify({ detail: "stubbed" }), {
              status: 503,
              headers: { "content-type": "application/problem+json", "retry-after": "0" },
            })
          : Response.json({ id: "rec-1" });
      const [returned, cached] = upstream.body!.tee();
      cachedBranches.push(cached); // held unread, like Next's cache entry
      return new Response(returned, { status: upstream.status, headers: upstream.headers });
    });
    vi.stubGlobal("fetch", fetchStub);
    const client = await getClient();

    const { data } = await hub.getFeedbackRecord({ client, path: { id: "rec-1" }, throwOnError: true });

    expect(data).toMatchObject({ id: "rec-1" });
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
