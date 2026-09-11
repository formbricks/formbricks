import { beforeEach, describe, expect, test, vi } from "vitest";
import { bootstrapFreshAuthzedActivation } from "./activation-protocol";
import {
  acquireAuthzedPreparationLease,
  activateAuthzedAuthorization,
  createPreparedAuthzedActivationReceipt,
  finalizeAuthzedActivation,
  getAuthzedActivationReceipt,
  getAuthzedActivationStatus,
  recoverExpiredFreshAuthzedActivation,
} from "./activation-repository";
import { checkAuthzedRuntimeActivation } from "./activation-runtime";

const { digest } = vi.hoisted(() => ({
  digest: (character: string): `sha256:${string}` => `sha256:${character.repeat(64)}`,
}));

vi.mock("@/lib/env", () => ({
  env: { AUTHZED_CONSISTENCY: "fully_consistent", AUTHZED_ENABLED: "true" },
}));
vi.mock("@formbricks/database", () => ({ prisma: { organization: { count: vi.fn() } } }));
vi.mock("./activation-contract", () => ({
  getAuthzedAuthorizationContractDigest: vi.fn(() => digest("b")),
  getAuthzedClientConfigDigest: vi.fn(() => digest("d")),
  getCanonicalAuthzedSchemaDigest: vi.fn(async () => digest("c")),
}));
vi.mock("./activation-repository", () => ({
  abandonAuthzedPreparation: vi.fn(),
  abortAuthzedActivation: vi.fn(),
  acquireAuthzedPreparationLease: vi.fn(),
  activateAuthzedAuthorization: vi.fn(),
  beginAuthzedRollback: vi.fn(),
  completeAuthzedRollback: vi.fn(),
  createPreparedAuthzedActivationReceipt: vi.fn(),
  finalizeAuthzedActivation: vi.fn(),
  getAuthzedActivationReceipt: vi.fn(),
  getAuthzedActivationStatus: vi.fn(),
  getLatestAuthzedSourceSequence: vi.fn(async () => 0n),
  recoverExpiredFreshAuthzedActivation: vi.fn(),
}));
vi.mock("./activation-runtime", () => ({ checkAuthzedRuntimeActivation: vi.fn() }));
vi.mock("./backfill", () => ({ runAuthzedBackfill: vi.fn() }));
vi.mock("./backfill-apply", () => ({
  createAuthzedBackfillApply: vi.fn(),
  createAuthzedBackfillNoopApply: vi.fn(),
}));
vi.mock("./client", () => ({
  closeAuthzedClient: vi.fn(),
  configureAuthzedClientForBulkWork: vi.fn(),
  getAuthzedClient: vi.fn(),
}));
vi.mock("./health", () => ({ checkAuthzedHealth: vi.fn(async () => ({ latencyMs: 0, status: "healthy" })) }));
vi.mock("./outbox-processor", () => ({ drainAuthzedOutbox: vi.fn() }));
vi.mock("./outbox-repository", () => ({ getAuthzedOutboxStatus: vi.fn() }));
vi.mock("./release-manifest", () => ({
  createAuthzedReleaseManifestDigest: vi.fn(() => digest("a")),
  readAuthzedReleaseManifest: vi.fn(async () => ({ authorizationMode: "spicedb_authoritative" })),
}));
vi.mock("./schema", () => ({
  applyCanonicalAuthzedSchema: vi.fn(),
  checkCanonicalAuthzedSchema: vi.fn(),
}));

const receiptId = "5d847b79-ae35-45d0-9dc5-595c1ccbdf61";

const status = (
  overrides: Partial<Awaited<ReturnType<typeof getAuthzedActivationStatus>>> = {}
): Awaited<ReturnType<typeof getAuthzedActivationStatus>> => ({
  activeReceiptId: null,
  authority: "legacy",
  fenceActive: false,
  generation: 1n,
  pendingReceiptId: null,
  transition: "idle",
  ...overrides,
});

const receipt = (
  overrides: Partial<Awaited<ReturnType<typeof getAuthzedActivationReceipt>>> = {}
): Awaited<ReturnType<typeof getAuthzedActivationReceipt>> => ({
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
  status: "prepared",
  ...overrides,
});

describe("fresh AuthZed activation bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(status());
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(receipt());
    vi.mocked(createPreparedAuthzedActivationReceipt).mockResolvedValue(receiptId);
    vi.mocked(checkAuthzedRuntimeActivation).mockResolvedValue({ authority: "spicedb", status: "ready" });
  });

  test("is an idempotent no-op after a compatible activation", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({ activeReceiptId: receiptId, authority: "spicedb", transition: "idle" })
    );
    const countOrganizations = vi.fn();

    await bootstrapFreshAuthzedActivation({ countOrganizations });

    expect(checkAuthzedRuntimeActivation).toHaveBeenCalledOnce();
    expect(countOrganizations).not.toHaveBeenCalled();
    expect(activateAuthzedAuthorization).not.toHaveBeenCalled();
  });

  test("finalizes an interrupted fresh activation but never finalizes an upgrade", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({
        activeReceiptId: receiptId,
        authority: "spicedb",
        fenceActive: true,
        transition: "activating",
      })
    );
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(receipt({ status: "active" }));

    await bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn() });
    expect(finalizeAuthzedActivation).toHaveBeenCalledWith(receiptId, digest("a"), expect.any(Function));

    vi.clearAllMocks();
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({
        activeReceiptId: receiptId,
        authority: "spicedb",
        fenceActive: true,
        transition: "activating",
      })
    );
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(
      receipt({
        bridgeImageDigest: digest("e"),
        bridgeManifestDigest: digest("f"),
        candidateImageDigest: digest("0"),
        kind: "upgrade",
        status: "active",
      })
    );
    vi.mocked(checkAuthzedRuntimeActivation).mockResolvedValue({ authority: "spicedb", status: "ready" });

    await bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn() });
    expect(finalizeAuthzedActivation).not.toHaveBeenCalled();
  });

  test("resumes an existing prepared fresh-install receipt", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({ pendingReceiptId: receiptId, transition: "prepared" })
    );

    await bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn(async () => 0) });

    expect(acquireAuthzedPreparationLease).not.toHaveBeenCalled();
    expect(activateAuthzedAuthorization).toHaveBeenCalledWith(receiptId, digest("a"), expect.any(Function));
    expect(finalizeAuthzedActivation).toHaveBeenCalledWith(receiptId, digest("a"), expect.any(Function));
  });

  test("recovers an expired fresh-install fence before resuming", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({ fenceActive: false, pendingReceiptId: receiptId, transition: "activating" })
    );

    await bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn(async () => 0) });

    expect(recoverExpiredFreshAuthzedActivation).toHaveBeenCalledWith(receiptId, digest("a"));
    expect(activateAuthzedAuthorization).toHaveBeenCalled();
  });

  test("does not race another bootstrap while its fresh-install fence is active", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({ fenceActive: true, pendingReceiptId: receiptId, transition: "activating" })
    );

    await expect(
      bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn(async () => 0) })
    ).rejects.toMatchObject({ code: "authzed_failed_precondition" });
    expect(activateAuthzedAuthorization).not.toHaveBeenCalled();
  });

  test("refuses to activate a populated uninitialized database", async () => {
    await expect(
      bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn(async () => 1) })
    ).rejects.toMatchObject({ code: "authzed_failed_precondition" });
    expect(acquireAuthzedPreparationLease).not.toHaveBeenCalled();
  });

  test("does not reuse a pending upgrade receipt as a fresh install", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({ pendingReceiptId: receiptId, transition: "prepared" })
    );
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(
      receipt({
        bridgeImageDigest: digest("e"),
        bridgeManifestDigest: digest("f"),
        candidateImageDigest: digest("0"),
        kind: "upgrade",
      })
    );

    await expect(
      bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn(async () => 0) })
    ).rejects.toMatchObject({ code: "authzed_activation_manifest_mismatch" });
    expect(activateAuthzedAuthorization).not.toHaveBeenCalled();
  });
});
