import { beforeEach, describe, expect, test, vi } from "vitest";
import { redisSecondaryStorage } from "./secondary-storage";

const mockClient = {
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  getDel: vi.fn(),
  eval: vi.fn(),
};

vi.mock("redis", () => ({ createClient: vi.fn(() => mockClient) }));
vi.mock("@/lib/env", () => ({ env: { REDIS_URL: "redis://localhost:6379" } }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

describe("redisSecondaryStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The unit config resets mock implementations between tests; re-establish the lazy connect so
    // getClient()'s `client.connect().then(...)` resolves (it's memoized after the first call).
    mockClient.connect.mockResolvedValue(undefined);
  });

  test("get reads through to the client", async () => {
    mockClient.get.mockResolvedValue("value");
    expect(await redisSecondaryStorage.get("k")).toBe("value");
    expect(mockClient.get).toHaveBeenCalledWith("k");
  });

  test("set with a ttl uses EX", async () => {
    await redisSecondaryStorage.set("k", "v", 60);
    expect(mockClient.set).toHaveBeenCalledWith("k", "v", { EX: 60 });
  });

  test("set without a ttl omits EX", async () => {
    await redisSecondaryStorage.set("k", "v");
    expect(mockClient.set).toHaveBeenCalledWith("k", "v");
  });

  test("set passes a 0 ttl through (not silently dropped)", async () => {
    await redisSecondaryStorage.set("k", "v", 0);
    expect(mockClient.set).toHaveBeenCalledWith("k", "v", { EX: 0 });
  });

  test("delete reads through to the client", async () => {
    await redisSecondaryStorage.delete("k");
    expect(mockClient.del).toHaveBeenCalledWith("k");
  });

  test("getAndDelete uses GETDEL when supported and otherwise remembers the atomic Lua fallback", async () => {
    const connectionError = new Error("Socket closed unexpectedly");
    mockClient.getDel
      .mockResolvedValueOnce("native")
      .mockRejectedValueOnce(connectionError)
      .mockRejectedValueOnce(
        new Error("ERR unknown command `GETDEL`, with args beginning with: `verification:key`")
      );
    mockClient.eval.mockResolvedValueOnce("once").mockResolvedValueOnce(null);

    expect(await redisSecondaryStorage.getAndDelete("native-key")).toBe("native");
    await expect(redisSecondaryStorage.getAndDelete("closed-key")).rejects.toBe(connectionError);
    expect(await redisSecondaryStorage.getAndDelete("verification:key")).toBe("once");
    expect(await redisSecondaryStorage.getAndDelete("verification:missing")).toBeNull();

    expect(mockClient.getDel).toHaveBeenCalledTimes(3);
    expect(mockClient.getDel).toHaveBeenNthCalledWith(1, "native-key");
    expect(mockClient.getDel).toHaveBeenNthCalledWith(2, "closed-key");
    expect(mockClient.getDel).toHaveBeenNthCalledWith(3, "verification:key");
    expect(mockClient.eval).toHaveBeenCalledTimes(2);
    const [script, options] = mockClient.eval.mock.calls[0];
    expect(script).toContain("redis.call('GET', KEYS[1])");
    expect(script).toContain("redis.call('DEL', KEYS[1])");
    expect(options).toEqual({ keys: ["verification:key"], arguments: [] });
    expect(mockClient.eval.mock.calls[1][1]).toEqual({ keys: ["verification:missing"], arguments: [] });
  });

  test("increment runs a single atomic INCR+EXPIRE Lua eval and returns the count", async () => {
    mockClient.eval.mockResolvedValue(1);
    expect(await redisSecondaryStorage.increment("k", 90)).toBe(1);
    expect(mockClient.eval).toHaveBeenCalledTimes(1);
    const [script, options] = mockClient.eval.mock.calls[0];
    expect(script).toContain("INCR");
    expect(script).toContain("EXPIRE");
    // TTL is applied only on the first increment (count === 1)
    expect(script).toContain("count == 1");
    expect(options).toEqual({ keys: ["k"], arguments: ["90"] });
  });

  test("increment coerces the Lua reply to a number", async () => {
    mockClient.eval.mockResolvedValue("5");
    expect(await redisSecondaryStorage.increment("k", 90)).toBe(5);
  });
});
