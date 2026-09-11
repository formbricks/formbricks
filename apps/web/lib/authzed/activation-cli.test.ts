import { beforeEach, describe, expect, test, vi } from "vitest";
import { runAuthzedActivationCli } from "./activation-cli";
import type { TAuthzedActivationCliCommand } from "./activation-cli-command";
import { AuthzedError } from "./errors";

const receipt = "5d847b79-ae35-45d0-9dc5-595c1ccbdf61";

const dependencies = () => ({
  abort: vi.fn().mockResolvedValue(undefined),
  activate: vi.fn().mockResolvedValue(undefined),
  bootstrap: vi.fn().mockResolvedValue(undefined),
  finalize: vi.fn().mockResolvedValue(undefined),
  prepare: vi.fn().mockResolvedValue(receipt),
  rollback: vi.fn().mockResolvedValue(undefined),
  runtimeCheck: vi.fn().mockResolvedValue({ authority: "spicedb", status: "ready" }),
  runtimeWait: vi.fn().mockResolvedValue({ authority: "spicedb", status: "ready" }),
  status: vi.fn().mockResolvedValue({
    activeReceiptId: receipt,
    authority: "spicedb",
    fenceActive: false,
    generation: 7n,
    pendingReceiptId: null,
    transition: "idle",
  }),
  writeOutput: vi.fn(),
});

describe("AuthZed activation CLI", () => {
  beforeEach(() => vi.clearAllMocks());

  test("prints the receipt only for prepare so a later phase can consume it", async () => {
    const deps = dependencies();
    const command = {
      action: "prepare",
      bridgeImageDigest: `sha256:${"a".repeat(64)}` as const,
      bridgeManifestDigest: `sha256:${"b".repeat(64)}` as const,
      candidateImageDigest: `sha256:${"c".repeat(64)}` as const,
      candidateManifestDigest: `sha256:${"d".repeat(64)}` as const,
    } satisfies TAuthzedActivationCliCommand;

    await expect(runAuthzedActivationCli(command, deps)).resolves.toBe(0);
    expect(deps.writeOutput).toHaveBeenCalledWith(`${JSON.stringify({ receipt, status: "prepared" })}\n`);
  });

  test("status exposes aggregate state without receipt identifiers", async () => {
    const deps = dependencies();
    await expect(runAuthzedActivationCli({ action: "status" }, deps)).resolves.toBe(0);
    const output = vi.mocked(deps.writeOutput).mock.calls[0]?.[0] ?? "";
    expect(JSON.parse(output)).toEqual({
      authority: "spicedb",
      fenceActive: false,
      generation: "7",
      status: "ready",
      transition: "idle",
    });
    expect(output).not.toContain(receipt);
  });

  test("maps failures to one stable secret-safe JSON result", async () => {
    const deps = dependencies();
    deps.runtimeCheck.mockRejectedValue(
      new AuthzedError({
        attempts: 0,
        code: "authzed_activation_required",
        operation: "private-operation",
        retryable: false,
      })
    );

    await expect(runAuthzedActivationCli({ action: "runtime_check" }, deps)).resolves.toBe(1);
    expect(deps.writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({ code: "authzed_activation_required", retryable: false, status: "failed" })}\n`
    );
  });

  test("passes bounded wait settings to the runtime waiter", async () => {
    const deps = dependencies();

    await expect(
      runAuthzedActivationCli({ action: "runtime_wait", intervalMs: 5_000, timeoutMs: 900_000 }, deps)
    ).resolves.toBe(0);

    expect(deps.runtimeWait).toHaveBeenCalledWith({ intervalMs: 5_000, timeoutMs: 900_000 });
    expect(deps.writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({ authority: "spicedb", status: "ready" })}\n`
    );
  });
});
