import { disconnect, runBackfill } from "./__mocks__/authzed-backfill.mock";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "./authzed-schema-results";

/**
 * `apps/web/scripts/**` is excluded from coverage, so this is a contract test rather than a behavioural
 * one: it asserts the entry point stays a thin argv shim and that every decision lives in the covered
 * command module.
 */
describe("authzed backfill script", () => {
  const scriptSource = readFileSync(new URL("./authzed-backfill.ts", import.meta.url), "utf8");

  test("delegates parsing and execution to the covered command module", () => {
    expect(scriptSource).toContain("parseAuthzedBackfillCommand");
    expect(scriptSource).toContain("runAuthzedBackfillCli");
  });

  test("contains no guard logic of its own", () => {
    // The prune guards must be in lib/authzed/backfill-cli.ts, where the coverage gate applies.
    for (const guard of ["--prune", "--confirm-prune", "--expected-endpoint", "maxPrune"]) {
      // Mentioning a flag in the usage doc-block is fine; branching on one is not.
      expect(scriptSource).not.toMatch(new RegExp(`(if|includes|startsWith)[^\\n]*${guard}`));
    }
  });

  test("reports an exit code rather than exiting the process", () => {
    // process.exit would skip the single-JSON-line output contract the automation depends on.
    expect(scriptSource).toContain("process.exitCode");
    expect(scriptSource).not.toContain("process.exit(");
  });
});

describe("authzed backfill entrypoint", () => {
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

  test.each([
    { args: ["--apply"], exitCode: 0 },
    { args: ["--scope=survey", "--apply", "--mark-ready"], exitCode: 2 },
  ])("runs $args, keeps its exit code, and disconnects the database", async ({ args, exitCode }) => {
    // The PostgreSQL pool's idle sockets would otherwise keep the process alive after the result.
    process.argv = ["node", "authzed-backfill.ts", ...args];
    runBackfill.mockResolvedValue(exitCode);

    await import("./authzed-backfill");
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
    expect(runBackfill).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(exitCode);
  });

  test("disconnects after a failed run without masking the sanitized result", async () => {
    process.argv = ["node", "authzed-backfill.ts", "--apply"];
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    runBackfill.mockRejectedValue(new Error("private-sdk-error"));
    disconnect.mockRejectedValue(new Error("private-database-error"));

    await import("./authzed-backfill");
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
    expect(stdout).toHaveBeenCalledExactlyOnceWith(`${JSON.stringify(INVALID_CONFIGURATION_RESULT)}\n`);
    expect(process.exitCode).toBe(1);
  });

  test("rejects invalid arguments without loading the database", async () => {
    process.argv = ["node", "authzed-backfill.ts", "--unknown"];
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    await import("./authzed-backfill");
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(stdout).toHaveBeenCalledExactlyOnceWith(`${JSON.stringify(INVALID_REQUEST_RESULT)}\n`);
    expect(runBackfill).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });
});
