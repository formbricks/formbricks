import { describe, expect, test, vi } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { runAuthzedSchemaCli } from "./schema-cli";

vi.mock("./client", () => ({ closeAuthzedClient: vi.fn() }));
vi.mock("./schema", () => ({
  applyCanonicalAuthzedSchema: vi.fn(),
  checkCanonicalAuthzedSchema: vi.fn(),
}));

const matchedResult = {
  differenceCount: 0,
  differenceKinds: {},
  remoteDigest: "sha256:remote",
  remoteState: "present",
  sourceDigest: "sha256:source",
  status: "matched",
} as const;

const driftedResult = {
  differenceCount: 1,
  differenceKinds: { definition_added: 1 },
  remoteDigest: "sha256:remote",
  remoteState: "present",
  sourceDigest: "sha256:source",
  status: "drifted",
} as const;

describe("runAuthzedSchemaCli", () => {
  test.each([
    [matchedResult, 0],
    [driftedResult, 2],
  ] as const)("serializes a check result and returns exit code %i", async (result, exitCode) => {
    const closeClient = vi.fn();
    const writeOutput = vi.fn();

    await expect(
      runAuthzedSchemaCli(
        { action: "check" },
        {
          checkSchema: vi.fn().mockResolvedValue(result),
          closeClient,
          writeOutput,
        }
      )
    ).resolves.toBe(exitCode);

    expect(writeOutput).toHaveBeenCalledOnce();
    expect(writeOutput).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
    expect(closeClient).toHaveBeenCalledOnce();
  });

  test.each(["applied", "unchanged"] as const)("returns success for an %s apply", async (status) => {
    const result = {
      differenceCount: 0,
      remoteDigest: "sha256:remote",
      remoteState: "present",
      sourceDigest: "sha256:source",
      status,
    } as const;
    const applySchema = vi.fn().mockResolvedValue(result);
    const closeClient = vi.fn();
    const writeOutput = vi.fn();

    await expect(
      runAuthzedSchemaCli(
        { action: "apply", expectedCurrentDigest: "sha256:previous" },
        { applySchema, closeClient, writeOutput }
      )
    ).resolves.toBe(0);

    expect(applySchema).toHaveBeenCalledWith("sha256:previous");
    expect(writeOutput).toHaveBeenCalledWith(`${JSON.stringify(result)}\n`);
    expect(closeClient).toHaveBeenCalledOnce();
  });

  test("prints only the stable error contract and closes the client on failure", async () => {
    const secret = "never-log-this-authzed-token";
    const closeClient = vi.fn();
    const writeOutput = vi.fn();

    await expect(
      runAuthzedSchemaCli(
        { action: "apply" },
        {
          applySchema: vi.fn().mockRejectedValue(
            new AuthzedError({
              attempts: 1,
              cause: new Error(secret),
              code: AUTHZED_ERROR_CODES.UNAVAILABLE,
              operation: "write_schema",
              retryable: true,
            })
          ),
          closeClient,
          writeOutput,
        }
      )
    ).resolves.toBe(1);

    expect(writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        retryable: true,
        status: "failed",
      })}\n`
    );
    expect(JSON.stringify(writeOutput.mock.calls)).not.toContain(secret);
    expect(closeClient).toHaveBeenCalledOnce();
  });

  test("sanitizes unexpected errors", async () => {
    const secret = "never-log-this-schema";
    const writeOutput = vi.fn();

    await expect(
      runAuthzedSchemaCli(
        { action: "check" },
        {
          checkSchema: vi.fn().mockRejectedValue(new Error(secret)),
          closeClient: vi.fn(),
          writeOutput,
        }
      )
    ).resolves.toBe(1);

    expect(writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({
        code: AUTHZED_ERROR_CODES.INTERNAL,
        retryable: false,
        status: "failed",
      })}\n`
    );
    expect(JSON.stringify(writeOutput.mock.calls)).not.toContain(secret);
  });
});
