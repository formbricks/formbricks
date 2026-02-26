import { beforeEach, describe, expect, test, vi } from "vitest";
import FormbricksHub from "@formbricks/hub";

vi.mock("@formbricks/hub", () => {
  const MockFormbricksHub = vi.fn();
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
  formbricksHubClient: FormbricksHub | undefined;
};

describe("getHubClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalForHub.formbricksHubClient = undefined;
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
    const mockInstance = { feedbackRecords: {} } as unknown as FormbricksHub;
    vi.mocked(FormbricksHub).mockReturnValue(mockInstance);

    const { getHubClient } = await import("./hub-client");
    const client = getHubClient();

    expect(FormbricksHub).toHaveBeenCalledWith({ apiKey: "test-key", baseURL: "https://hub.test" });
    expect(client).toBe(mockInstance);
    expect(globalForHub.formbricksHubClient).toBe(mockInstance);
  });

  test("returns cached client on subsequent calls", async () => {
    const cachedInstance = { feedbackRecords: {} } as unknown as FormbricksHub;
    globalForHub.formbricksHubClient = cachedInstance;

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
    expect(globalForHub.formbricksHubClient).toBeUndefined();

    mutableEnv.HUB_API_KEY = "now-set";
    const mockInstance = { feedbackRecords: {} } as unknown as FormbricksHub;
    vi.mocked(FormbricksHub).mockReturnValue(mockInstance);

    const second = getHubClient();
    expect(second).toBe(mockInstance);
    expect(globalForHub.formbricksHubClient).toBe(mockInstance);
  });
});
