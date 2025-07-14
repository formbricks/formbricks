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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup mocks
    mockOn.mockReturnValue({ connect: mockConnect });
    mockCreateClient.mockReturnValue({ on: mockOn });
    mockConnect.mockResolvedValue({});

    vi.doMock("redis", () => ({
      createClient: mockCreateClient,
    }));

    vi.doMock("@formbricks/logger", () => ({
      logger: mockLogger,
    }));
  });

  test("should create Redis client when REDIS_URL is provided", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await import("./redis");

    expect(mockCreateClient).toHaveBeenCalledWith({ url: "redis://localhost:6379" });
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockConnect).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test("should return null when REDIS_URL is not provided", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: undefined,
    }));

    const redis = await import("./redis");

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith("REDIS_URL is not set");
    expect(redis.default).toBeNull();
  });

  test("should return null when REDIS_URL is empty string", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "",
    }));

    const redis = await import("./redis");

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith("REDIS_URL is not set");
    expect(redis.default).toBeNull();
  });

  test("should handle Redis connection errors", async () => {
    const testError = new Error("Redis connection failed");

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    const redis = await import("./redis");

    // Simulate error handler being called
    const errorHandler = mockOn.mock.calls[0][1];
    errorHandler(testError);

    expect(mockLogger.error).toHaveBeenCalledWith("Error creating redis client", testError);
  });

  test("should handle Redis client creation failure", async () => {
    const testError = new Error("Client creation failed");
    mockCreateClient.mockImplementation(() => {
      throw testError;
    });

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await expect(import("./redis")).rejects.toThrow(testError);
  });

  test("should handle Redis connection failure", async () => {
    const testError = new Error("Connection failed");
    mockConnect.mockRejectedValue(testError);

    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await expect(import("./redis")).rejects.toThrow(testError);
  });

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
      expect(redis.default).toBeNull();
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

  test("should set up error handler before connecting", async () => {
    vi.doMock("@/lib/constants", () => ({
      REDIS_URL: "redis://localhost:6379",
    }));

    await import("./redis");

    // Verify the chain: createClient -> on -> connect
    expect(mockCreateClient).toHaveBeenCalledBefore(mockOn);
    expect(mockOn).toHaveBeenCalledBefore(mockConnect);
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
