// Import pino after the mock is defined
import Pino from "pino";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LOG_LEVELS } from "../types/logger";

// Store original environment variables outside any function
const originalNodeEnv = process.env.NODE_ENV;
const originalLogLevel = process.env.LOG_LEVEL;
const originalNextRuntime = process.env.NEXT_RUNTIME;

// Define the mock before any imports that use it
// Move mock outside of any function to avoid hoisting issues
vi.mock("pino", () => {
  // Create a factory function that returns the mock
  return {
    default: vi.fn(() => ({
      debug: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      error: vi.fn().mockReturnThis(),
      fatal: vi.fn().mockReturnThis(),
      child: vi.fn().mockReturnThis(),
      flush: vi.fn(),
    })),
    stdSerializers: {
      err: vi.fn(),
      req: vi.fn(),
      res: vi.fn(),
    },
  };
});

describe("Logger", () => {
  beforeEach(() => {
    // Clear module cache to reset logger for each test
    vi.resetModules();

    // Reset mocks
    vi.clearAllMocks();

    // Set default environment for tests
    process.env.NODE_ENV = "development";
    process.env.LOG_LEVEL = "info";
    process.env.NEXT_RUNTIME = "nodejs";
  });

  afterEach(() => {
    // Restore process.env
    process.env.NODE_ENV = originalNodeEnv;
    process.env.LOG_LEVEL = originalLogLevel;
    process.env.NEXT_RUNTIME = originalNextRuntime;
  });

  test("logger is created with development config when NODE_ENV is not production", async () => {
    process.env.NODE_ENV = "development";
    const { logger } = await import("./logger");

    expect(Pino).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: expect.objectContaining({
          target: "pino-pretty",
        }) as Pino.TransportSingleOptions,
      })
    );

    expect(logger).toBeDefined();
  });

  test("logger is created with production config when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";
    const { logger } = await import("./logger");

    expect(Pino).toHaveBeenCalledWith(
      expect.not.objectContaining({
        transport: expect.any(Object) as Pino.TransportSingleOptions,
      })
    );

    expect(logger).toBeDefined();
  });

  test("getLogLevel defaults to 'info' in development mode", async () => {
    process.env.NODE_ENV = "development";
    process.env.LOG_LEVEL = undefined;

    const { logger: _logger } = await import("./logger");

    expect(Pino).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
      })
    );
  });

  test("getLogLevel defaults to 'warn' in production mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.LOG_LEVEL = undefined;

    const { logger: _logger } = await import("./logger");

    expect(Pino).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warn",
      })
    );
  });

  test("getLogLevel respects LOG_LEVEL env variable when valid", async () => {
    process.env.LOG_LEVEL = "debug";

    const { logger: _logger } = await import("./logger");

    expect(Pino).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "debug",
      })
    );
  });

  test("withContext creates a child logger with provided context", async () => {
    // Clear cache to get a fresh instance
    vi.resetModules();

    // Create a child spy before importing the logger
    const childSpy = vi.fn().mockReturnThis();

    // Set up the mock to capture the child call
    vi.mocked(Pino).mockReturnValue({
      debug: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      error: vi.fn().mockReturnThis(),
      fatal: vi.fn().mockReturnThis(),
      child: childSpy,
      flush: vi.fn(),
    } as unknown as Pino.Logger<string>);

    // Now import the logger with our updated mock
    const { logger } = await import("./logger");

    const context = { requestId: "123", userId: "456" };
    logger.withContext(context);

    // Check that the child method was called with the context
    expect(childSpy).toHaveBeenCalledWith(context);
  });

  test("request creates a child logger with HTTP request info", async () => {
    // Clear cache to get a fresh instance
    vi.resetModules();

    // Create a child spy before importing the logger
    const childSpy = vi.fn().mockReturnThis();

    // Set up the mock to capture the child call
    vi.mocked(Pino).mockReturnValue({
      debug: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
      warn: vi.fn().mockReturnThis(),
      error: vi.fn().mockReturnThis(),
      fatal: vi.fn().mockReturnThis(),
      child: childSpy,
      flush: vi.fn(),
    } as unknown as Pino.Logger<string>);

    // Now import the logger with our updated mock
    const { logger } = await import("./logger");

    const req = {
      method: "GET",
      url: "https://example.com/test",
    };

    logger.request(req as unknown as Request);

    // Check that the child method was called with the expected object
    expect(childSpy).toHaveBeenCalledWith({
      method: "GET",
      url: "https://example.com/test",
    });
  });

  test("logger has all expected log level methods", async () => {
    const { logger } = await import("./logger");

    LOG_LEVELS.forEach((level) => {
      expect(typeof logger[level]).toBe("function");
    });
  });

  test("process handlers are attached in Node.js environment", async () => {
    const processSpy = vi.spyOn(process, "on");
    processSpy.mockImplementation(() => process); // Return process for chaining

    process.env.NEXT_RUNTIME = "nodejs";

    await import("./logger");

    // Check that process handlers were attached
    expect(processSpy).toHaveBeenCalledWith("uncaughtException", expect.any(Function));
    expect(processSpy).toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
    expect(processSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));

    processSpy.mockRestore();
  });

  test("process handlers are not attached outside Node.js environment", async () => {
    const processSpy = vi.spyOn(process, "on");
    processSpy.mockImplementation(() => process); // Return process for chaining

    process.env.NEXT_RUNTIME = "edge";

    await import("./logger");

    // No handlers should be attached for particular events
    expect(processSpy).not.toHaveBeenCalledWith("uncaughtException", expect.any(Function));
    expect(processSpy).not.toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
    expect(processSpy).not.toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processSpy).not.toHaveBeenCalledWith("SIGINT", expect.any(Function));

    processSpy.mockRestore();
  });
});
