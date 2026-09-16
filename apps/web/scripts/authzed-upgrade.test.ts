import { disconnect, runUpgrade } from "./__mocks__/authzed-upgrade.mock";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { INVALID_CONFIGURATION_RESULT } from "./authzed-schema-results";

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("LOG_LEVEL", "fatal");
  disconnect.mockResolvedValue(undefined);
});

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("development upgrade entrypoint", () => {
  test.each([
    { command: "prepare", exitCode: 0 },
    { command: "check", exitCode: 2 },
  ])("dispatches $command, preserves its exit code, and disconnects", async ({ command, exitCode }) => {
    process.argv = ["node", "authzed-upgrade.ts", command];
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    runUpgrade.mockImplementation(async () => {
      expect(console.error).toBe(stderr);
      return exitCode;
    });

    await import("./authzed-upgrade");
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
    expect(runUpgrade).toHaveBeenCalledWith({ action: command });
    expect(process.exitCode).toBe(exitCode);
    expect(console.error).toBe(stderr);
  });

  test("sanitizes unexpected failures and disconnects without masking the result", async () => {
    process.argv = ["node", "authzed-upgrade.ts", "check"];
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    runUpgrade.mockRejectedValue(new Error("private-sdk-error"));
    disconnect.mockRejectedValue(new Error("private-database-error"));

    await import("./authzed-upgrade");
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
    expect(stdout).toHaveBeenCalledExactlyOnceWith(`${JSON.stringify(INVALID_CONFIGURATION_RESULT)}\n`);
    expect(stderr).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(console.error).toBe(stderr);
  });
});
