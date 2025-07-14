import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/constants");
vi.mock("redis");
vi.mock("@formbricks/logger");

describe("redis module", () => {
  const mockConnect = vi.fn();
  const mockOn = vi.fn();
  const mockCreateClient = vi.fn();
  const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Create a mock client that supports method chaining
    const mockClient = {
      on: mockOn,
      connect: mockConnect,
    };

    // Setup mocks for method chaining
    mockOn.mockReturnValue(mockClient);
    mockCreateClient.mockReturnValue(mockClient);
    mockConnect.mockResolvedValue(undefined);

    vi.doMock("redis", () => ({
      createClient: mockCreateClient,
    }));

    vi.doMock("@formbricks/logger", () => ({
      logger: mockLogger,
    }));
  });

  test("should export getRedisClient function when REDIS_URL is provided", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    const redis = await import("./redis");

    expect(mockCreateClient).toHaveBeenCalledWith({ url: "redis://localhost:6379" });
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("reconnecting", expect.any(Function));
    expect(redis.default).toBeInstanceOf(Function);
    expect(redis.getRedisClient).toBeInstanceOf(Function);
  });

  test("should return getRedisClient function when REDIS_URL is not provided", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: undefined,
    }));

    const redis = await import("./redis");

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith("REDIS_URL is not set");
    expect(redis.default).toBeInstanceOf(Function);
    expect(redis.getRedisClient).toBeInstanceOf(Function);

    // Test that calling the function returns null
    const client = await redis.default();
    expect(client).toBeNull();
  });

  test("should return getRedisClient function when REDIS_URL is empty string", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "",
    }));

    const redis = await import("./redis");

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith("REDIS_URL is not set");
    expect(redis.default).toBeInstanceOf(Function);

    // Test that calling the function returns null
    const client = await redis.default();
    expect(client).toBeNull();
  });

  test("should handle Redis connection errors gracefully", async () => {
    const testError = new Error("Redis connection failed");

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await import("./redis");

    // Simulate error handler being called
    const errorHandler = mockOn.mock.calls.find((call) => call[0] === "error")?.[1];
    expect(errorHandler).toBeDefined();
    errorHandler(testError);

    expect(mockLogger.error).toHaveBeenCalledWith("Redis client error", testError);
  });

  test("should handle Redis client creation failure gracefully", async () => {
    const testError = new Error("Client creation failed");
    mockCreateClient.mockImplementation(() => {
      throw testError;
    });

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    const redis = await import("./redis");

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to connect to Redis - Redis will be unavailable",
      testError
    );
    expect(redis.default).toBeInstanceOf(Function);

    // Test that calling the function returns null
    const client = await redis.default();
    expect(client).toBeNull();
  });

  test("should handle Redis connection failure gracefully", async () => {
    const testError = new Error("Connection failed");
    mockConnect.mockRejectedValue(testError);

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    const redis = await import("./redis");

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to connect to Redis - Redis will be unavailable",
      testError
    );
    expect(redis.default).toBeInstanceOf(Function);

    // Test that calling the function returns null
    const client = await redis.default();
    expect(client).toBeNull();
  });

  test("should handle connection timeout gracefully", async () => {
    // Mock a slow connection that would timeout
    mockConnect.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000)));

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    const redis = await import("./redis");

    // Test that calling the function returns null due to timeout
    const client = await redis.default();
    expect(client).toBeNull();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to connect to Redis - Redis will be unavailable",
      expect.objectContaining({ message: "Redis connection timeout" })
    );
  }, 10000); // Increase test timeout to 10 seconds

  test("should log warning for null, undefined, or empty REDIS_URL values", async () => {
    const testValues = [null, undefined, "", false, 0];

    for (const value of testValues) {
      vi.clearAllMocks();
      vi.resetModules();

      vi.doMock("@/lib/constants", () => ({
        REDIS_URL: value,
      }));

      vi.doMock("@formbricks/logger", () => ({
        logger: mockLogger,
      }));

      const redis = await import("./redis");

      expect(mockLogger.warn).toHaveBeenCalledWith("REDIS_URL is not set");
      expect(redis.default).toBeInstanceOf(Function);

      // Test that calling the function returns null
      const client = await redis.default();
      expect(client).toBeNull();
    }
  });

  test("should create Redis client with correct configuration", async () => {
    const testUrl = "redis://user:pass@localhost:6380/1"; // NOSONAR // This is a test URL

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: testUrl,
    }));

    await import("./redis");

    expect(mockCreateClient).toHaveBeenCalledWith({ url: testUrl });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  test("should set up all event handlers before connecting", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await import("./redis");

    // Verify all event handlers are set up
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("reconnecting", expect.any(Function));
    expect(mockOn).toHaveBeenCalledTimes(3);
  });

  test("should log successful connection", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    const redis = await import("./redis");

    // Test that calling the function returns the client
    const client = await redis.default();
    expect(client).toBeDefined();
    expect(client).not.toBeNull();
    expect(mockLogger.info).toHaveBeenCalledWith("Redis connected successfully");
  });

  test("should handle disconnect event", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await import("./redis");

    // Simulate disconnect handler being called
    const disconnectHandler = mockOn.mock.calls.find((call) => call[0] === "disconnect")?.[1];
    expect(disconnectHandler).toBeDefined();
    disconnectHandler();

    expect(mockLogger.warn).toHaveBeenCalledWith("Redis client disconnected");
  });

  test("should handle reconnecting event", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await import("./redis");

    // Simulate reconnecting handler being called
    const reconnectingHandler = mockOn.mock.calls.find((call) => call[0] === "reconnecting")?.[1];
    expect(reconnectingHandler).toBeDefined();
    reconnectingHandler();

    expect(mockLogger.info).toHaveBeenCalledWith("Redis client reconnecting");
  });

  test("should return same client instance on multiple calls", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    const redis = await import("./redis");

    const client1 = await redis.default();
    const client2 = await redis.default();

    expect(client1).toBe(client2);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });
});
