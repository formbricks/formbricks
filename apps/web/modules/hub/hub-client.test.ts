import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as hub from "@formbricks/hub";
import { createHubResultFromError, getHubErrorHint } from "./utils";

/**
 * `getHubClient`, driven through the real SDK with only the global transport stubbed — so what is
 * asserted is the request that would actually leave the process and the error a caller actually gets.
 */
vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: {
    HUB_API_KEY: "",
    HUB_API_URL: "https://hub.test",
  },
}));

const { env } = await import("@/lib/env");

const mutableEnv = env as unknown as Record<string, string>;

const globalForHub = globalThis as unknown as { formbricksHubHeyApiClient: unknown };

const stubFetch = (respond: () => Response = () => Response.json({ data: [], limit: 50 })) => {
  const fetchStub = vi.fn(async (_request: Request) => respond());
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
};

const sentRequest = (fetchStub: ReturnType<typeof stubFetch>, call = 0): Request =>
  fetchStub.mock.calls[call][0];

const getClient = async () => {
  mutableEnv.HUB_API_KEY = "test-key";
  const { getHubClient } = await import("./hub-client");
  const client = getHubClient();
  if (!client) throw new Error("expected a client");
  return client;
};

beforeEach(() => {
  vi.resetModules();
  globalForHub.formbricksHubHeyApiClient = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Here rather than in the test that fakes them: a failure before its own restore would leave fake timers
  // installed, and every later test's retry backoff would then never fire.
  vi.useRealTimers();
});

describe("getHubClient", () => {
  test("returns null when HUB_API_KEY is not set", async () => {
    mutableEnv.HUB_API_KEY = "";

    const { getHubClient } = await import("./hub-client");

    expect(getHubClient()).toBeNull();
  });

  test("returns the cached client on subsequent calls", async () => {
    const client = await getClient();
    const { getHubClient } = await import("./hub-client");

    expect(getHubClient()).toBe(client);
    expect(globalForHub.formbricksHubHeyApiClient).toBe(client);
  });

  test("does not cache null result so a later call with the key set can create the client", async () => {
    mutableEnv.HUB_API_KEY = "";
    const { getHubClient } = await import("./hub-client");

    expect(getHubClient()).toBeNull();
    expect(globalForHub.formbricksHubHeyApiClient).toBeUndefined();

    mutableEnv.HUB_API_KEY = "now-set";

    expect(getHubClient()).not.toBeNull();
  });

  test("addresses HUB_API_URL and authenticates with HUB_API_KEY as a bearer token", async () => {
    const fetchStub = stubFetch();
    const client = await getClient();

    await hub.listFeedbackRecords({ client, query: { tenant_id: "dir_1" }, throwOnError: true });

    const request = sentRequest(fetchStub);
    expect(request.url).toBe("https://hub.test/v1/feedback-records?tenant_id=dir_1");
    expect(request.headers.get("authorization")).toBe("Bearer test-key");
  });
});

/**
 * The regression the SDK move exists for is pinned upstream (`sdks/typescript/tests/wire.test.mjs` in
 * formbricks/hub). These are the two wire details *this* app depends on that the upstream test does not
 * cover.
 */
describe("wire format", () => {
  // The regression the SDK move exists for: the Hub does not split commas, so a comma-joined array is a
  // 400 on the enum filters and an empty page on the string ones. Pinned here as well as upstream, so an
  // SDK bump that changes the default serializer fails in this repo too.
  test("sends a multi-value filter as repeated parameters, not comma-joined", async () => {
    const fetchStub = stubFetch();
    const client = await getClient();

    await hub.listFeedbackRecords({
      client,
      query: { tenant_id: "dir_1", source_type: ["survey", "review"] },
      throwOnError: true,
    });

    const { url } = sentRequest(fetchStub);
    expect(new URL(url).searchParams.getAll("source_type")).toEqual(["survey", "review"]);
    expect(url).not.toContain("%2C");
  });

  test("sends an empty source_id, which is the no-source bucket rather than 'no filter'", async () => {
    const fetchStub = stubFetch(() => Response.json({ data: [] }));
    const client = await getClient();

    await hub.listTaxonomyRuns({
      client,
      query: { tenant_id: "dir_1", source_type: "survey", source_id: "", field_id: "q1" },
      throwOnError: true,
    });

    // Dropping it would make Hub read "any source" (Hub PR #88).
    expect(new URL(sentRequest(fetchStub).url).searchParams.get("source_id")).toBe("");
  });

  test("encodes path ids, so an id cannot address a different route", async () => {
    const fetchStub = stubFetch(() =>
      Response.json({ tenant_id: "a/b", status: "accepted" }, { status: 202 })
    );
    const client = await getClient();

    await hub.purgeTenantFeedbackRecords({ client, path: { tenant_id: "a/b" }, throwOnError: true });

    expect(sentRequest(fetchStub).url).toBe("https://hub.test/v1/tenants/a%2Fb/feedback-records");
  });
});

describe("errors", () => {
  test("a Hub error response arrives as an Error carrying its status and problem body", async () => {
    const body = { code: "validation", detail: "since must be a valid timestamp", status: 400 };
    stubFetch(() =>
      Response.json(body, { status: 400, headers: { "content-type": "application/problem+json" } })
    );
    const client = await getClient();

    const error = await hub
      .countFeedbackRecords({ client, query: { tenant_id: "dir_1" }, throwOnError: true })
      .catch((err: unknown) => err);

    // Unwrapped, the client throws the bare parsed body: no status, and "[object Object]" as a message.
    // By name, not `instanceof`: `vi.resetModules()` gives each test its own copy of `utils.ts`, the same
    // dual-module-scope effect that makes `utils.ts` duck-type these errors.
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("name", "HubApiError");
    expect(error).toMatchObject({ status: 400, error: body });
    expect(createHubResultFromError(error).error).toMatchObject({
      status: 400,
      message: `400 ${JSON.stringify(body)}`,
      code: "validation",
      problemDetail: "since must be a valid timestamp",
    });
  });

  test("a non-JSON error body keeps its text as the message", async () => {
    stubFetch(() => new Response("upstream exploded", { status: 400 }));
    const client = await getClient();

    const error = await hub
      .getFeedbackRecord({ client, path: { id: "rec-1" }, throwOnError: true })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ status: 400, message: "400 upstream exploded" });
  });

  test("an empty error body still reports its status", async () => {
    stubFetch(() => new Response(null, { status: 404 }));
    const client = await getClient();

    const error = await hub
      .getFeedbackRecord({ client, path: { id: "rec-1" }, throwOnError: true })
      .catch((err: unknown) => err);

    expect(error).toMatchObject({ status: 404, message: "404 status code (no body)" });
  });

  test("a connection failure passes through untouched, so the unreachable-Hub hint still fires", async () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8080"), { code: "ECONNREFUSED" });
    const fetchFailed = new TypeError("fetch failed", { cause: refused });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw fetchFailed;
      })
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const client = await getClient();

    const pending = hub
      .getFeedbackRecord({ client, path: { id: "rec-1" }, throwOnError: true })
      .catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    const error = await pending;

    expect(error).toBe(fetchFailed);
    expect(createHubResultFromError(error).error?.status).toBe(0);
    expect(getHubErrorHint(error)).toContain("Hub looks unreachable");
  });

  // A 2xx whose body does not parse — a proxy's error page served as JSON, say. Without its status it
  // would read as status 0, the same as a Hub that was never reached.
  test("a 2xx with an unparseable body keeps its status, with the parse error as the cause", async () => {
    stubFetch(
      () =>
        new Response("<html>gateway</html>", { status: 200, headers: { "content-type": "application/json" } })
    );
    const client = await getClient();

    const error = await hub
      .getFeedbackRecord({ client, path: { id: "rec-1" }, throwOnError: true })
      .catch((err: unknown) => err);

    expect(error).toHaveProperty("name", "HubApiError");
    expect(error).toMatchObject({ status: 200, message: "200 response body could not be parsed" });
    expect((error as Error).cause).toBeInstanceOf(SyntaxError);
    expect(createHubResultFromError(error).error?.status).toBe(200);
  });

  test("a 204 delete resolves rather than failing to parse an empty body", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    const client = await getClient();

    await expect(
      hub.deleteFeedbackRecord({ client, path: { id: "rec-1" }, throwOnError: true })
    ).resolves.toBeDefined();
  });
});
