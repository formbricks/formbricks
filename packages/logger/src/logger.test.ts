// Import pino after the mock is defined
import Pino from "pino";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LOG_LEVELS } from "../types/logger";

// Store original environment variables outside any function
const originalNodeEnv = process.env.NODE_ENV;
const originalLogLevel = process.env.LOG_LEVEL;
const originalNextRuntime = process.env.NEXT_RUNTIME;

function createMockLogger(): Pino.Logger {
  return {
    debug: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    audit: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    error: vi.fn().mockReturnThis(),
    fatal: vi.fn().mockReturnThis(),
    child: vi.fn().mockReturnThis(),
    flush: vi.fn(),
    level: "info",
    trace: vi.fn().mockReturnThis(),
    silent: vi.fn().mockReturnThis(),
    // LoggerExtras
    version: "1.0.0",
    levels: {
      values: {},
      labels: {},
    },
    useLevelLabels: false,
    levelVal: 30,
    setLevel: vi.fn(),
    setBindings: vi.fn(),
    getBindings: vi.fn(),
    isLevelEnabled: vi.fn().mockReturnValue(true),
    pino: vi.fn(),
    // EventEmitter methods
    onChild: vi.fn(),
    on: vi.fn(),
    addListener: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    emit: vi.fn(),
    listenerCount: vi.fn(),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    eventNames: vi.fn(),
    listeners: vi.fn(),
    rawListeners: vi.fn(),
    // Remaining required properties
    bindings: () => ({ level: "info", severity: "info" }),
    setMaxListeners: vi.fn(),
    getMaxListeners: vi.fn(),
    // Custom levels for logger
    customLevels: { audit: 35 },
    useOnlyCustomLevels: true,
  } as unknown as Pino.Logger;
}

// Define the mock before any imports that use it
// Move mock outside of any function to avoid hoisting issues
vi.mock("pino", () => {
  return {
    default: vi.fn(() => createMockLogger()),
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

    const mockLogger = createMockLogger();
    mockLogger.child = childSpy;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Required to mock Pino.Logger with generics in strict TypeScript, as TS cannot infer the correct generic type for the mock object
    vi.mocked(Pino).mockReturnValue(mockLogger as any);

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

    const mockLogger = createMockLogger();
    mockLogger.child = childSpy;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Required to mock Pino.Logger with generics in strict TypeScript, as TS cannot infer the correct generic type for the mock object
    vi.mocked(Pino).mockReturnValue(mockLogger as any);

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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Required to mock Pino.Logger with generics in strict TypeScript, as TS cannot infer the correct generic type for the mock object
    vi.mocked(Pino).mockReturnValue(createMockLogger() as any);

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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Required to mock Pino.Logger with generics in strict TypeScript, as TS cannot infer the correct generic type for the mock object
    vi.mocked(Pino).mockReturnValue(createMockLogger() as any);

    await import("./logger");

    // No handlers should be attached for particular events
    expect(processSpy).not.toHaveBeenCalledWith("uncaughtException", expect.any(Function));
    expect(processSpy).not.toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
    expect(processSpy).not.toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processSpy).not.toHaveBeenCalledWith("SIGINT", expect.any(Function));

    processSpy.mockRestore();
  });
});
