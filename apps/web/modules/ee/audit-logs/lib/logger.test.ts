import * as fs from "fs";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const AUDIT_LOG_PATH = "/tmp/audit.log";

// Helper to reload the module with different constants and logger mock
async function importLoggerWithConstants(enabled: boolean, loggerErrorSpy?: any) {
  vi.doMock("@/lib/constants", () => ({
    AUDIT_LOG_ENABLED: enabled,
    AUDIT_LOG_PATH,
  }));
  vi.doMock("@formbricks/logger", () => ({
    logger: { error: loggerErrorSpy || vi.fn() },
  }));
  return await import("./logger");
}

vi.mock("fs");
vi.mock("pino", async () => {
  const actual = await vi.importActual<typeof import("pino")>("pino");
  return {
    __esModule: true,
    ...actual,
    default: vi.fn(() => ({ info: vi.fn() })),
  };
});

describe("auditLogger (logger.ts)", () => {
  const mockedFs = vi.mocked(fs);
  const mockedPino = vi.mocked(pino);
  let intervalSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    intervalSpy = vi.spyOn(global, "setInterval");
  });
  afterEach(() => {
    vi.resetModules();
    intervalSpy.mockRestore();
  });

  test("exports a disabled logger if AUDIT_LOG_ENABLED is false", async () => {
    const mod = await importLoggerWithConstants(false);
    expect(mockedPino).toHaveBeenCalledWith({ enabled: false });
    expect(mod.auditLogger).toBeDefined();
  });

  test("exports an enabled logger with correct config if AUDIT_LOG_ENABLED is true", async () => {
    const mod = await importLoggerWithConstants(true);
    expect(mockedPino).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
        transport: expect.objectContaining({
          target: "pino/file",
          options: expect.objectContaining({ destination: AUDIT_LOG_PATH }),
        }),
      })
    );
    expect(mod.auditLogger).toBeDefined();
  });

  test("immediately sets file permissions to 0o600 if file exists", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    await importLoggerWithConstants(true);
    expect(mockedFs.chmodSync).toHaveBeenCalledWith(AUDIT_LOG_PATH, 0o600);
  });

  test("does not call chmodSync if file does not exist on startup", async () => {
    mockedFs.existsSync.mockReturnValue(false);
    await importLoggerWithConstants(true);
    expect(mockedFs.chmodSync).not.toHaveBeenCalled();
  });

  test("logs error if chmodSync throws on startup", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.chmodSync.mockImplementation(() => {
      throw new Error("fail");
    });
    const loggerErrorSpy = vi.fn();
    await importLoggerWithConstants(true, loggerErrorSpy);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Error setting audit log file permissions on startup",
      expect.any(Error)
    );
  });

  test("sets up interval to enforce 0o600 permissions", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ mode: 0o644 } as any);
    await importLoggerWithConstants(true);
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    // Simulate interval callback
    const intervalFn = intervalSpy.mock.calls[0][0];
    intervalFn();
    expect(mockedFs.statSync).toHaveBeenCalledWith(AUDIT_LOG_PATH);
    expect(mockedFs.chmodSync).toHaveBeenCalledWith(AUDIT_LOG_PATH, 0o600);
  });

  test("does not call chmodSync in interval if file already 0o600", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ mode: 0o600 } as any);
    await importLoggerWithConstants(true);
    const callsBefore = mockedFs.chmodSync.mock.calls.length;
    const intervalFn = intervalSpy.mock.calls[0][0];
    intervalFn();
    // Should not call chmodSync again in interval
    expect(mockedFs.chmodSync.mock.calls.length).toBe(callsBefore);
  });

  test("logs error if chmodSync throws in interval", async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.statSync.mockReturnValue({ mode: 0o644 } as any);
    mockedFs.chmodSync.mockImplementation(() => {
      throw new Error("fail");
    });
    const loggerErrorSpy = vi.fn();
    await importLoggerWithConstants(true, loggerErrorSpy);
    const intervalFn = intervalSpy.mock.calls[0][0];
    intervalFn();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Error setting audit log file permissions on interval",
      expect.any(Error)
    );
  });

  test("does nothing if AUDIT_LOG_ENABLED is false (no fs or interval)", async () => {
    await importLoggerWithConstants(false);
    expect(mockedFs.existsSync).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
