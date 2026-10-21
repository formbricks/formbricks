import { rootCertificates } from "node:tls";
import { createClient } from "redis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { redisSecondaryStorage } from "./secondary-storage";

const mockClient = {
  isOpen: true,
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  getDel: vi.fn(),
  eval: vi.fn(),
};

vi.mock("redis", () => ({ createClient: vi.fn(() => mockClient) }));
const mockEnv = vi.hoisted(() => ({
  REDIS_URL: "redis://localhost:6379" as string | undefined,
  REDIS_TLS_CA: undefined as string | undefined,
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

describe("redisSecondaryStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.isOpen = true;
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
    expect(await redisSecondaryStorage.getAndDelete("verification:key")).toBeNull();

    expect(mockClient.getDel).toHaveBeenCalledTimes(3);
    expect(mockClient.getDel).toHaveBeenNthCalledWith(1, "native-key");
    expect(mockClient.getDel).toHaveBeenNthCalledWith(2, "closed-key");
    expect(mockClient.getDel).toHaveBeenNthCalledWith(3, "verification:key");
    expect(mockClient.eval).toHaveBeenCalledTimes(2);
    const [, options] = mockClient.eval.mock.calls[0];
    expect(options).toEqual({ keys: ["verification:key"], arguments: [] });
    expect(mockClient.eval.mock.calls[1][1]).toEqual({ keys: ["verification:key"], arguments: [] });
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

  test("rejects a missing Redis URL before opening an authentication connection", async () => {
    vi.resetModules();
    mockEnv.REDIS_URL = undefined;
    try {
      const { redisSecondaryStorage: freshStorage } = await import("./secondary-storage");
      await expect(freshStorage.get("k")).rejects.toThrow("REDIS_URL is required for authentication storage");
      expect(createClient).not.toHaveBeenCalled();
    } finally {
      mockEnv.REDIS_URL = "redis://localhost:6379";
    }
  });

  test("uses private CA verification for the separate authentication connection", async () => {
    vi.resetModules();
    mockEnv.REDIS_URL = "rediss://127.0.0.1:6378";
    mockEnv.REDIS_TLS_CA = rootCertificates[0];
    try {
      const { redisSecondaryStorage: freshStorage } = await import("./secondary-storage");
      mockClient.get.mockResolvedValue("value");
      expect(await freshStorage.get("k")).toBe("value");
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          socket: {
            tls: true,
            ca: [rootCertificates[0].trim()],
            rejectUnauthorized: true,
            connectTimeout: 3000,
            reconnectStrategy: expect.any(Function),
          },
        })
      );
    } finally {
      mockEnv.REDIS_URL = "redis://localhost:6379";
      mockEnv.REDIS_TLS_CA = undefined;
    }
  });

  test("creates the client with a heartbeat", async () => {
    vi.resetModules();
    const { redisSecondaryStorage: freshStorage } = await import("./secondary-storage");
    mockClient.get.mockResolvedValue("value");

    expect(await freshStorage.get("k")).toBe("value");
    expect(createClient).toHaveBeenCalledWith({
      url: "redis://localhost:6379",
      socket: { connectTimeout: 3000, reconnectStrategy: expect.any(Function) },
      pingInterval: 300_000,
    });
  });

  test("retries the lazy connection after a failed connect", async () => {
    vi.resetModules();
    const connectionError = new Error("Connection failed");
    mockClient.connect.mockRejectedValueOnce(connectionError).mockResolvedValueOnce(undefined);
    mockClient.get.mockResolvedValue("value");
    const { redisSecondaryStorage: freshStorage } = await import("./secondary-storage");

    await expect(freshStorage.get("k")).rejects.toBe(connectionError);
    await expect(freshStorage.get("k")).resolves.toBe("value");
    expect(mockClient.connect).toHaveBeenCalledTimes(2);
  });

  test("recreates a previously established connection after reconnection is exhausted", async () => {
    vi.resetModules();
    const { redisSecondaryStorage: freshStorage } = await import("./secondary-storage");
    const firstClient = {
      ...mockClient,
      connect: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue("original"),
    };
    const replacementClient = {
      ...mockClient,
      connect: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue("replacement"),
    };
    vi.mocked(createClient)
      .mockReturnValueOnce(firstClient as unknown as ReturnType<typeof createClient>)
      .mockReturnValueOnce(replacementClient as unknown as ReturnType<typeof createClient>);
    await expect(freshStorage.get("k")).resolves.toBe("original");
    firstClient.isOpen = false;
    await expect(freshStorage.get("k")).resolves.toBe("replacement");
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(firstClient.connect).toHaveBeenCalledTimes(1);
    expect(replacementClient.connect).toHaveBeenCalledTimes(1);
    expect(firstClient.get).toHaveBeenCalledTimes(1);
    expect(replacementClient.get).toHaveBeenCalledTimes(1);
  });
});
