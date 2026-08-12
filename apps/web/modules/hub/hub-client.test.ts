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
 * A stand-in client instance. `getHubClient` probes the freshly built client to confirm array query
 * params still serialize as repeated ones, so every fake needs a `buildURL` — `repeated: false` produces
 * the comma form the real SDK defaults to, which is what the probe exists to reject.
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

  test("refuses to hand back a client that comma-joins array query params", async () => {
    mutableEnv.HUB_API_KEY = "test-key";
    // Stands in for a future SDK release that stops routing query serialization through
    // `stringifyQuery`: our override would become an unused method — legal TypeScript, no type error, and
    // filters silently stop matching. Nothing but this probe catches that.
    const commaJoining = fakeClient({ repeated: false });
    vi.mocked(FormbricksHub).mockImplementation(function () {
      return commaJoining as any;
    });

    const { getHubClient } = await import("./hub-client");

    expect(() => getHubClient()).toThrow(/no longer routes query serialization through stringifyQuery/);
    // Never cached, so the next call re-probes rather than serving a known-broken client.
    expect(globalForHub.formbricksHubClientRepeatArrays).toBeUndefined();
  });
});
