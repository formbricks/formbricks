import { describe, expect, test, vi } from "vitest";
import { runAuthzedHealthCli } from "./cli";
import { AUTHZED_ERROR_CODES } from "./errors";

vi.mock("./client", () => ({ closeAuthzedClient: vi.fn() }));
vi.mock("./health", () => ({ checkAuthzedHealth: vi.fn() }));

describe("runAuthzedHealthCli", () => {
  test.each([
    [{ status: "disabled" } as const, 1],
    [{ latencyMs: 12, status: "healthy" } as const, 0],
    [
      {
        code: AUTHZED_ERROR_CODES.UNAUTHENTICATED,
        latencyMs: 7,
        retryable: false,
        status: "unhealthy",
      } as const,
      1,
    ],
  ])("serializes one stable JSON result and returns exit code %i", async (healthResult, exitCode) => {
    const closeClient = vi.fn();
    const writeOutput = vi.fn();

    await expect(
      runAuthzedHealthCli({
        checkHealth: vi.fn().mockResolvedValue(healthResult),
        closeClient,
        writeOutput,
      })
    ).resolves.toBe(exitCode);

    expect(writeOutput).toHaveBeenCalledOnce();
    expect(writeOutput).toHaveBeenCalledWith(`${JSON.stringify(healthResult)}\n`);
    expect(closeClient).toHaveBeenCalledOnce();
  });

  test("sanitizes unexpected errors and closes the client", async () => {
    const token = "never-log-this-authzed-token";
    const closeClient = vi.fn();
    const writeOutput = vi.fn();

    await expect(
      runAuthzedHealthCli({
        checkHealth: vi.fn().mockRejectedValue(new Error(`Bearer ${token}`)),
        closeClient,
        writeOutput,
      })
    ).resolves.toBe(1);

    expect(writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({
        code: AUTHZED_ERROR_CODES.INTERNAL,
        latencyMs: 0,
        retryable: false,
        status: "unhealthy",
      })}\n`
    );
    expect(JSON.stringify(writeOutput.mock.calls)).not.toContain(token);
    expect(closeClient).toHaveBeenCalledOnce();
  });
});
