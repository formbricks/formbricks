import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getAuthzedAuthorizationContractDigest,
  getAuthzedClientConfigDigest,
  getCanonicalAuthzedSchemaDigest,
} from "./activation-contract";
import { getAuthzedActivationReceipt, getAuthzedActivationStatus } from "./activation-repository";
import { checkAuthzedRuntimeActivation, waitForAuthzedRuntimeActivation } from "./activation-runtime";
import { createAuthzedReleaseManifestDigest, readAuthzedReleaseManifest } from "./release-manifest";

vi.mock("./activation-contract", () => ({
  getAuthzedAuthorizationContractDigest: vi.fn(),
  getAuthzedClientConfigDigest: vi.fn(),
  getCanonicalAuthzedSchemaDigest: vi.fn(),
}));
vi.mock("./activation-repository", () => ({
  getAuthzedActivationReceipt: vi.fn(),
  getAuthzedActivationStatus: vi.fn(),
}));
vi.mock("./release-manifest", () => ({
  createAuthzedReleaseManifestDigest: vi.fn(),
  readAuthzedReleaseManifest: vi.fn(),
}));

const digest = (character: string): `sha256:${string}` => `sha256:${character.repeat(64)}`;
const receiptId = "5d847b79-ae35-45d0-9dc5-595c1ccbdf61";
const manifest = {
  authorizationMode: "spicedb_authoritative" as const,
  clientContractVersion: 1,
  migrationHead: "20260911090000_add_authzed_activation_protocol",
  protocolVersion: 1,
  sourceRevision: "revision",
};

describe("AuthZed runtime activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readAuthzedReleaseManifest).mockResolvedValue(manifest);
    vi.mocked(createAuthzedReleaseManifestDigest).mockReturnValue(digest("a"));
    vi.mocked(getAuthzedAuthorizationContractDigest).mockReturnValue(digest("b"));
    vi.mocked(getCanonicalAuthzedSchemaDigest).mockResolvedValue(digest("c"));
    vi.mocked(getAuthzedClientConfigDigest).mockReturnValue(digest("d"));
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue({
      activeReceiptId: receiptId,
      authority: "spicedb",
      fenceActive: true,
      generation: 1n,
      pendingReceiptId: null,
      transition: "activating",
    });
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue({
      bridgeImageDigest: digest("e"),
      bridgeManifestDigest: digest("f"),
      candidateImageDigest: digest("0"),
      candidateManifestDigest: digest("a"),
      clientConfigDigest: digest("d"),
      contractDigest: digest("b"),
      generation: 1n,
      id: receiptId,
      kind: "upgrade",
      protocolVersion: 1,
      schemaDigest: digest("c"),
      status: "active",
    });
  });

  test("accepts a target image only for the exact database receipt", async () => {
    await expect(checkAuthzedRuntimeActivation()).resolves.toEqual({
      authority: "spicedb",
      status: "ready",
    });
  });

  test.each([
    ["candidateManifestDigest", digest("9")],
    ["clientConfigDigest", digest("9")],
    ["contractDigest", digest("9")],
    ["schemaDigest", digest("9")],
  ] as const)("fails closed when %s differs", async (field, value) => {
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue({
      bridgeImageDigest: digest("e"),
      bridgeManifestDigest: digest("f"),
      candidateImageDigest: digest("0"),
      candidateManifestDigest: digest("a"),
      clientConfigDigest: digest("d"),
      contractDigest: digest("b"),
      generation: 1n,
      id: receiptId,
      kind: "upgrade",
      protocolVersion: 1,
      schemaDigest: digest("c"),
      status: "active",
      [field]: value,
    });
    await expect(checkAuthzedRuntimeActivation()).rejects.toMatchObject({
      code: "authzed_activation_required",
    });
  });

  test.each([
    ["generation", 2n],
    ["protocolVersion", 2],
  ] as const)("fails closed when the receipt %s is incompatible", async (field, value) => {
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue({
      bridgeImageDigest: digest("e"),
      bridgeManifestDigest: digest("f"),
      candidateImageDigest: digest("0"),
      candidateManifestDigest: digest("a"),
      clientConfigDigest: digest("d"),
      contractDigest: digest("b"),
      generation: 1n,
      id: receiptId,
      kind: "upgrade",
      protocolVersion: 1,
      schemaDigest: digest("c"),
      status: "active",
      [field]: value,
    });

    await expect(checkAuthzedRuntimeActivation()).rejects.toMatchObject({
      code: "authzed_activation_required",
    });
  });

  test("lets the bridge serve legacy states without constructing AuthZed or reading a receipt", async () => {
    vi.mocked(readAuthzedReleaseManifest).mockResolvedValue({
      ...manifest,
      authorizationMode: "legacy_bridge",
    });
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue({
      activeReceiptId: null,
      authority: "legacy",
      fenceActive: false,
      generation: 0n,
      pendingReceiptId: null,
      transition: "idle",
    });
    await expect(checkAuthzedRuntimeActivation()).resolves.toEqual({
      authority: "legacy",
      status: "ready",
    });
    expect(getAuthzedActivationReceipt).not.toHaveBeenCalled();
    expect(getCanonicalAuthzedSchemaDigest).not.toHaveBeenCalled();
  });

  test("accepts a compatible successor target after activation is finalized", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue({
      activeReceiptId: receiptId,
      authority: "spicedb",
      fenceActive: false,
      generation: 1n,
      pendingReceiptId: null,
      transition: "idle",
    });
    vi.mocked(createAuthzedReleaseManifestDigest).mockReturnValue(digest("9"));

    await expect(checkAuthzedRuntimeActivation()).resolves.toEqual({
      authority: "spicedb",
      status: "ready",
    });
  });

  test("does not let a fresh-install target serve before bootstrap finalization", async () => {
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue({
      bridgeImageDigest: null,
      bridgeManifestDigest: null,
      candidateImageDigest: null,
      candidateManifestDigest: digest("a"),
      clientConfigDigest: digest("d"),
      contractDigest: digest("b"),
      generation: 1n,
      id: receiptId,
      kind: "fresh_install",
      protocolVersion: 1,
      schemaDigest: digest("c"),
      status: "active",
    });

    await expect(checkAuthzedRuntimeActivation()).rejects.toMatchObject({
      code: "authzed_activation_required",
    });
  });

  test("requires the exact supported bridge receipt before serving a rollback", async () => {
    vi.mocked(readAuthzedReleaseManifest).mockResolvedValue({
      ...manifest,
      authorizationMode: "legacy_bridge",
    });
    vi.mocked(createAuthzedReleaseManifestDigest).mockReturnValue(digest("f"));
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue({
      activeReceiptId: receiptId,
      authority: "spicedb",
      fenceActive: true,
      generation: 1n,
      pendingReceiptId: null,
      transition: "rolling_back",
    });

    await expect(checkAuthzedRuntimeActivation()).resolves.toEqual({
      authority: "legacy",
      status: "ready",
    });

    vi.mocked(createAuthzedReleaseManifestDigest).mockReturnValue(digest("9"));
    await expect(checkAuthzedRuntimeActivation()).rejects.toMatchObject({
      code: "authzed_activation_required",
    });
  });

  test("waits for activation using bounded database-only retries", async () => {
    let now = 0;
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error("not ready"))
      .mockRejectedValueOnce(new Error("still not ready"))
      .mockResolvedValue({ authority: "spicedb", status: "ready" });
    const sleep = vi.fn(async (durationMs: number) => {
      now += durationMs;
    });

    await expect(
      waitForAuthzedRuntimeActivation(
        { intervalMs: 1_000, timeoutMs: 5_000 },
        { check, now: () => now, sleep }
      )
    ).resolves.toEqual({ authority: "spicedb", status: "ready" });
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test("returns one stable failure after the startup wait expires", async () => {
    let now = 0;
    const check = vi.fn().mockRejectedValue(new Error("database details must stay private"));
    const sleep = vi.fn(async (durationMs: number) => {
      now += durationMs;
    });

    await expect(
      waitForAuthzedRuntimeActivation(
        { intervalMs: 1_000, timeoutMs: 2_500 },
        { check, now: () => now, sleep }
      )
    ).rejects.toMatchObject({
      code: "authzed_activation_required",
      operation: "activation_runtime_wait_timeout",
    });
    expect(sleep).toHaveBeenLastCalledWith(500);
  });
});
