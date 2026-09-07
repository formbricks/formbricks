import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type FormbricksHub from "@formbricks/hub";

/**
 * The wire-format contract between our Hub params and the URL the Hub actually receives.
 *
 * Every other hub spec stops at the first hop: `operations.test.ts` asserts the object handed to
 * `@/modules/hub/service`, and `service.test.ts` asserts the object handed to a fake SDK. Nothing
 * asserted the three hops after that — `client.feedbackRecords.list()` → `buildURL()` →
 * `stringifyQuery()` — which is exactly where the SDK silently comma-joins array filters while the Hub
 * documents `style: form, explode: true` and states that comma-separated values are NOT split. That gap
 * shipped a release in which `?source_type=survey,review` returned an empty page and a caller read it as
 * "there is no such feedback".
 *
 * So this spec deliberately mocks nothing below our own module boundary: the real SDK, the real
 * `hub-client`, the real `service`, and a stubbed global `fetch` to read the URL off. Only the ambient
 * concerns (env, logger, cache, server-only) are faked.
 *
 * Two SDK behaviours dictate the shape of the setup, both verified against @formbricks/hub@0.12.0:
 *   - The client captures `this.fetch` from the global at CONSTRUCTION, so the stub has to be installed
 *     before `getHubClient()` builds the singleton — hence the cache reset in `beforeEach`.
 *   - It calls `fetch(url, init)` with `url` as a plain string, not a `Request`. (The sibling idiom in
 *     `feedback-records-proxy.test.ts` reads `.url` off a `Request`; that one line differs here.)
 *
 * Assertions are `toBe` on the whole URL, never `toContain`. `toContain("field_type=text")` passes
 * against `field_type=text,rating` — the precise bug this file exists to catch.
 */

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: { HUB_API_KEY: "test-key", HUB_API_URL: "https://hub.test" },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: { withCache: vi.fn(async (fn: () => unknown) => fn()) },
}));

const globalForHub = globalThis as unknown as {
  formbricksHubClientRepeatArrays: FormbricksHub | undefined;
};

let fetchMock: ReturnType<typeof vi.fn>;

/** The URL the SDK passed to fetch on its first (and normally only) call. */
const requestedUrl = (): string => {
  expect(fetchMock).toHaveBeenCalled();
  return fetchMock.mock.calls[0][0] as string;
};

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: [], limit: 50, next_cursor: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
  // Installed before the client exists, because the SDK captures the global fetch at construction.
  vi.stubGlobal("fetch", fetchMock);
  globalForHub.formbricksHubClientRepeatArrays = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalForHub.formbricksHubClientRepeatArrays = undefined;
});

describe("feedback-record list query serialization", () => {
  test("sends each value of a multi-value filter as its own parameter", async () => {
    const { listFeedbackRecords } = await import("./service");

    await listFeedbackRecords({
      tenant_id: "dir_1",
      field_type: ["text", "rating"],
      source_type: ["survey", "review"],
    });

    // Repeated, not comma-joined. Comma form makes the Hub read one literal value: a 400 for the enum
    // filters, and a silent empty page for the string ones.
    expect(requestedUrl()).toBe(
      "https://hub.test/v1/feedback-records?tenant_id=dir_1&field_type=text&field_type=rating&source_type=survey&source_type=review"
    );
  });

  test("a one-element filter is indistinguishable from a scalar on the wire", async () => {
    const { listFeedbackRecords } = await import("./service");

    await listFeedbackRecords({ tenant_id: "dir_1", source_type: ["survey"] });

    // This is what makes the one-element wrapping introduced by the 0.12.0 bump a genuine no-op.
    expect(requestedUrl()).toBe("https://hub.test/v1/feedback-records?tenant_id=dir_1&source_type=survey");
  });

  test("keeps filters whose value is falsy but meaningful", async () => {
    const { listFeedbackRecords } = await import("./service");

    await listFeedbackRecords({
      tenant_id: "dir_1",
      has_sentiment: false,
      value_number_min: 0,
      sentiment_score_min: 0,
    });

    // `has_sentiment=false` is the only way to ask for records enrichment has not labelled yet. Dropping
    // it answers a different, much wider question without saying so.
    expect(requestedUrl()).toBe(
      "https://hub.test/v1/feedback-records?tenant_id=dir_1&has_sentiment=false&value_number_min=0&sentiment_score_min=0"
    );
  });

  test("percent-encodes a space rather than form-encoding it", async () => {
    const { listFeedbackRecords } = await import("./service");

    await listFeedbackRecords({ tenant_id: "dir_1", source_name: ["Q1 NPS survey"] });

    // %20, not `+`. Go would decode either, but keeping %20 makes this serializer a strict no-op for
    // every other endpoint sharing the client, so "did this change taxonomy?" has a one-word answer.
    expect(requestedUrl()).toBe(
      "https://hub.test/v1/feedback-records?tenant_id=dir_1&source_name=Q1%20NPS%20survey"
    );
  });

  test("escapes a literal plus so it does not arrive as a space", async () => {
    const { listFeedbackRecords } = await import("./service");

    await listFeedbackRecords({ tenant_id: "dir_1", language: ["pt+BR"] });

    expect(requestedUrl()).toBe("https://hub.test/v1/feedback-records?tenant_id=dir_1&language=pt%2BBR");
  });

  test("carries sort control through to the list endpoint", async () => {
    const { listFeedbackRecords } = await import("./service");

    await listFeedbackRecords({ tenant_id: "dir_1", sort: "created_at", order: "asc", limit: 10 });

    expect(requestedUrl()).toBe(
      "https://hub.test/v1/feedback-records?tenant_id=dir_1&sort=created_at&order=asc&limit=10"
    );
  });
});

describe("feedback-record count query serialization", () => {
  test("hits the count path with the same repeated filters and no pagination", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ count: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const { countFeedbackRecords } = await import("./service");

    await countFeedbackRecords({ tenant_id: "dir_1", sentiment: ["negative", "very_negative"] });

    expect(requestedUrl()).toBe(
      "https://hub.test/v1/feedback-records/count?tenant_id=dir_1&sentiment=negative&sentiment=very_negative"
    );
  });
});

describe("other endpoints sharing the client", () => {
  test("a scalar-only endpoint serializes exactly as before", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const { listTaxonomyFields } = await import("./service");

    await listTaxonomyFields("dir_1");

    // The serializer override is shared by every endpoint on this client. Feedback-record list/count are
    // the only ones with array-typed query params, and this turns that survey into an assertion.
    expect(requestedUrl()).toBe("https://hub.test/v1/taxonomy/fields?tenant_id=dir_1");
  });
});
