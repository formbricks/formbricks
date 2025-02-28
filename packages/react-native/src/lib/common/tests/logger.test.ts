// logger.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Logger } from "@/lib/common/logger";

// adjust import path as needed

describe("Logger", () => {
  let logger: Logger;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = Logger.getInstance();

    // Reset any existing singleton
    logger.resetInstance();

    logger = Logger.getInstance();

    // Mock console so we don't actually log in test output
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {
      return {
        ok: true,
        data: undefined,
      };
    });

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      return {
        ok: true,
        data: undefined,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("getInstance() returns a singleton", () => {
    const anotherLogger = Logger.getInstance();
    expect(logger).toBe(anotherLogger);
  });

  test("default logLevel is 'error', so debug messages shouldn't appear", () => {
    logger.debug("This is a debug log");
    logger.error("This is an error log");

    // debug should NOT be logged by default
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining("This is a debug log"));
    // error should be logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("[ERROR] - This is an error log"));
  });

  test("configure to logLevel=debug => debug messages appear", () => {
    logger.configure({ logLevel: "debug" });

    logger.debug("Debug log after config");
    logger.error("Error log after config");

    // debug should now appear
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/🧱 Formbricks.*\[DEBUG\].*Debug log after config/)
    );
    // error should appear as well
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/🧱 Formbricks.*\[ERROR\].*Error log after config/)
    );
  });

  test("logs have correct format including timestamp prefix", () => {
    logger.configure({ logLevel: "debug" });
    logger.debug("Some message");

    // Check that the log includes 🧱 Formbricks, timestamp, [DEBUG], and the message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(
        /^🧱 Formbricks - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z \[DEBUG\] - Some message$/
      )
    );
  });
});
