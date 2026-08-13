import { beforeEach, describe, expect, test, vi } from "vitest";
import FormbricksHub from "@formbricks/hub";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/hub", () => {
  // Must use `function` (not arrow) so it's valid as a `new` target.
  const MockFormbricksHub = vi.fn(function () {});
  return { default: MockFormbricksHub };
});

vi.mock("@/lib/env", () => ({
  env: {
    HUB_API_KEY: "",
    HUB_API_URL: "https://hub.test",
  },
}));

const { env } = await import("@/lib/env");

const mutableEnv = env as unknown as Record<string, string>;

const globalForHub = globalThis as unknown as {
  formbricksHubClientRepeatArrays: FormbricksHub | undefined;
};

/**
 * A stand-in client instance, with a `buildURL` shaped for `assertRepeatedArrayParams` below —
 * `repeated: false` produces the comma form the real SDK defaults to, which is what the probe exists to
 * reject. `getHubClient` itself no longer probes (see the `assertRepeatedArrayParams` tests for why), so
 * `buildURL` is unused by the `getHubClient` tests in this file; kept on the fake because it costs nothing
 * and keeps one shared fixture instead of two near-identical ones.
 */
const fakeClient = ({ repeated }: { repeated: boolean }): FormbricksHub =>
  ({
    feedbackRecords: {},
    buildURL: (path: string, query: Record<string, unknown>) => {
      const search = Object.entries(query ?? {})
        .map(([key, value]) =>
          Array.isArray(value) && repeated
            ? value.map((v) => `${key}=${String(v)}`).join("&")
            : `${key}=${Array.isArray(value) ? value.join("%2C") : String(value)}`
        )
        .join("&");
      return `https://hub.test${path}?${search}`;
    },
  }) as unknown as FormbricksHub;

describe("getHubClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalForHub.formbricksHubClientRepeatArrays = undefined;
  });

  test("returns null when HUB_API_KEY is not set", async () => {
    mutableEnv.HUB_API_KEY = "";

    const { getHubClient } = await import("./hub-client");
    const client = getHubClient();

    expect(client).toBeNull();
    expect(FormbricksHub).not.toHaveBeenCalled();
  });

  test("creates and caches a new client when HUB_API_KEY is set", async () => {
    mutableEnv.HUB_API_KEY = "test-key";
    const mockInstance = fakeClient({ repeated: true });
    vi.mocked(FormbricksHub).mockImplementation(function () {
      return mockInstance as any;
    });

    const { getHubClient } = await import("./hub-client");
    const client = getHubClient();

    expect(FormbricksHub).toHaveBeenCalledWith({ apiKey: "test-key", baseURL: "https://hub.test" });
    expect(client).toBe(mockInstance);
    expect(globalForHub.formbricksHubClientRepeatArrays).toBe(mockInstance);
  });

  test("returns cached client on subsequent calls", async () => {
    const cachedInstance = fakeClient({ repeated: true });
    globalForHub.formbricksHubClientRepeatArrays = cachedInstance;

    const { getHubClient } = await import("./hub-client");
    const client = getHubClient();

    expect(client).toBe(cachedInstance);
    expect(FormbricksHub).not.toHaveBeenCalled();
  });

  test("does not cache null result so a later call with the key set can create the client", async () => {
    mutableEnv.HUB_API_KEY = "";

    const { getHubClient } = await import("./hub-client");
    const first = getHubClient();
    expect(first).toBeNull();
    expect(globalForHub.formbricksHubClientRepeatArrays).toBeUndefined();

    mutableEnv.HUB_API_KEY = "now-set";
    const mockInstance = fakeClient({ repeated: true });
    vi.mocked(FormbricksHub).mockImplementation(function () {
      return mockInstance as any;
    });

    const second = getHubClient();
    expect(second).toBe(mockInstance);
    expect(globalForHub.formbricksHubClientRepeatArrays).toBe(mockInstance);
  });

  // getHubClient() no longer probes: the check is scoped to the two operations that send array filters
  // (see modules/hub/service.ts and its tests), so a construction-time probe failure can't turn a narrow
  // serialization regression into an outage for every other Hub consumer.
  test("does not verify array-param support at construction", async () => {
    mutableEnv.HUB_API_KEY = "test-key";
    const commaJoining = fakeClient({ repeated: false });
    vi.mocked(FormbricksHub).mockImplementation(function () {
      return commaJoining as any;
    });

    const { getHubClient } = await import("./hub-client");

    expect(() => getHubClient()).not.toThrow();
  });
});

describe("assertRepeatedArrayParams", () => {
  test("throws when the client comma-joins array query params", async () => {
    // Stands in for a future SDK release that stops routing query serialization through
    // `stringifyQuery`: our override would become an unused method — legal TypeScript, no type error, and
    // filters silently stop matching. Nothing but this probe catches that.
    const { assertRepeatedArrayParams } = await import("./hub-client");
    const commaJoining = fakeClient({ repeated: false });

    expect(() => assertRepeatedArrayParams(commaJoining)).toThrow(
      /no longer routes query serialization through stringifyQuery/
    );
  });

  test("does not throw when the client repeats array query params", async () => {
    const { assertRepeatedArrayParams } = await import("./hub-client");

    expect(() => assertRepeatedArrayParams(fakeClient({ repeated: true }))).not.toThrow();
  });

  test("memoizes success, so a client that later regresses is not re-probed", async () => {
    // The property can't change within a process once verified true — a single instance imported per
    // test (via the module-cache reset in the shared vitest setup) proves the memoization, not a
    // cross-test leak.
    const { assertRepeatedArrayParams } = await import("./hub-client");
    const goodClient = fakeClient({ repeated: true });
    const laterBrokenBuildURL = vi.fn(() => "https://hub.test/probe?p=a%2Cb");
    const laterBrokenClient = { ...goodClient, buildURL: laterBrokenBuildURL } as unknown as FormbricksHub;

    assertRepeatedArrayParams(goodClient);
    expect(() => assertRepeatedArrayParams(laterBrokenClient)).not.toThrow();
    expect(laterBrokenBuildURL).not.toHaveBeenCalled();
  });
});
