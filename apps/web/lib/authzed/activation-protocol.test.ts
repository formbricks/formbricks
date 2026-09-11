import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  activatePreparedAuthzedAuthorization,
  bootstrapFreshAuthzedActivation,
  finalizePreparedAuthzedAuthorization,
  prepareAuthzedActivation,
} from "./activation-protocol";
import {
  acquireAuthzedPreparationLease,
  activateAuthzedAuthorization,
  createPreparedAuthzedActivationReceipt,
  finalizeAuthzedActivation,
  getAuthzedActivationReceipt,
  getAuthzedActivationStatus,
  recoverExpiredFreshAuthzedActivation,
  renewAuthzedPreparationLease,
} from "./activation-repository";
import { checkAuthzedRuntimeActivation } from "./activation-runtime";
import { AuthzedError } from "./errors";
import { readAuthzedReleaseManifest } from "./release-manifest";

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
  renewAuthzedPreparationLease: vi.fn(),
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

const cleanAudit = {
  completedAtSnapshot: "snapshot",
  counters: {
    failed: 0,
    ignored: 0,
    invalid: 0,
    mismatchedParents: 0,
    mismatchedPermissions: 0,
    missing: 0,
    orphaned: 0,
    pruned: 0,
    reconciled: 1,
    scanned: 1,
    skipped: 0,
    unmanaged: 0,
  },
  failures: [],
  lastOrganizationId: null,
  mismatchedParents: [],
  mismatchedPermissions: [],
  mode: "apply" as const,
  orphanScope: "all" as const,
  orphans: [],
  scope: "all" as const,
  status: "reconciled" as const,
  truncated: false,
  unmanaged: [],
};

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

  test("preserves a finalization failure while the same activation is still in progress", async () => {
    const activatingStatus = status({
      activeReceiptId: receiptId,
      authority: "spicedb",
      fenceActive: true,
      transition: "activating",
    });
    vi.mocked(getAuthzedActivationStatus)
      .mockResolvedValueOnce(activatingStatus)
      .mockResolvedValueOnce(activatingStatus);
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(receipt({ status: "active" }));
    const finalizationError = new AuthzedError({
      attempts: 0,
      code: "authzed_activation_graph_dirty",
      operation: "activation_schema_verify",
      retryable: false,
    });
    vi.mocked(finalizeAuthzedActivation).mockRejectedValue(finalizationError);

    await expect(bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn() })).rejects.toBe(
      finalizationError
    );

    expect(getAuthzedActivationStatus).toHaveBeenCalledTimes(2);
    expect(checkAuthzedRuntimeActivation).not.toHaveBeenCalled();
  });

  test("accepts a lost finalization response only after the same receipt reached idle", async () => {
    vi.mocked(getAuthzedActivationStatus)
      .mockResolvedValueOnce(
        status({
          activeReceiptId: receiptId,
          authority: "spicedb",
          fenceActive: true,
          transition: "activating",
        })
      )
      .mockResolvedValueOnce(
        status({ activeReceiptId: receiptId, authority: "spicedb", transition: "idle" })
      );
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(receipt({ status: "active" }));
    vi.mocked(finalizeAuthzedActivation).mockRejectedValue(new Error("transaction response lost"));

    await expect(bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn() })).resolves.toBeUndefined();

    expect(getAuthzedActivationStatus).toHaveBeenCalledTimes(2);
    expect(checkAuthzedRuntimeActivation).toHaveBeenCalledOnce();
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

  test("retries rather than bypassing an active preparation lease", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(status({ transition: "preparing" }));
    vi.mocked(acquireAuthzedPreparationLease).mockRejectedValueOnce({
      code: "authzed_activation_conflict",
    });

    await expect(
      bootstrapFreshAuthzedActivation({ countOrganizations: vi.fn(async () => 0) })
    ).rejects.toMatchObject({ code: "authzed_activation_conflict" });

    expect(acquireAuthzedPreparationLease).toHaveBeenCalledOnce();
    expect(createPreparedAuthzedActivationReceipt).not.toHaveBeenCalled();
    expect(activateAuthzedAuthorization).not.toHaveBeenCalled();
  });

  test("recovers preparation after an expired lease is acquired", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(status({ transition: "preparing" }));

    await bootstrapFreshAuthzedActivation({
      applySchema: vi.fn(async () => ({ sourceDigest: digest("c") })) as never,
      audit: vi.fn(async (mode) => ({ ...cleanAudit, mode })),
      checkSchema: vi.fn(async () => ({ status: "matched" }) as never),
      countOrganizations: vi.fn(async () => 0),
      drainOutbox: vi.fn(async () => ({
        claimed: 0,
        deadLettered: 0,
        delivered: 0,
        failed: 0,
        remaining: 0,
        status: "drained" as const,
      })),
      getOutboxStatus: vi.fn(async () => ({
        deadLettered: 0,
        oldestPendingAgeSeconds: null,
        overdueRevocations: 0,
        pending: 0,
        revocationsPastCritical: 0,
        revocationsPastWarning: 0,
      })),
    });

    expect(acquireAuthzedPreparationLease).toHaveBeenCalledOnce();
    expect(createPreparedAuthzedActivationReceipt).toHaveBeenCalledOnce();
    expect(activateAuthzedAuthorization).toHaveBeenCalledWith(receiptId, digest("a"), expect.any(Function));
    expect(finalizeAuthzedActivation).toHaveBeenCalledWith(receiptId, digest("a"), expect.any(Function));
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

describe("AuthZed activation preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readAuthzedReleaseManifest).mockResolvedValue({ authorizationMode: "legacy_bridge" } as never);
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(status());
    vi.mocked(createPreparedAuthzedActivationReceipt).mockResolvedValue(receiptId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns the same prepared receipt when the previous CLI response was lost", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({ pendingReceiptId: receiptId, transition: "prepared" })
    );
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(
      receipt({
        bridgeImageDigest: digest("1"),
        bridgeManifestDigest: digest("a"),
        candidateImageDigest: digest("2"),
        candidateManifestDigest: digest("3"),
        kind: "upgrade",
      })
    );

    await expect(
      prepareAuthzedActivation({
        bridgeImageDigest: digest("1"),
        bridgeManifestDigest: digest("a"),
        candidateImageDigest: digest("2"),
        candidateManifestDigest: digest("3"),
      })
    ).resolves.toBe(receiptId);

    expect(acquireAuthzedPreparationLease).not.toHaveBeenCalled();
    expect(createPreparedAuthzedActivationReceipt).not.toHaveBeenCalled();
  });

  test("rejects a prepared receipt from a different immutable plan", async () => {
    vi.mocked(getAuthzedActivationStatus).mockResolvedValue(
      status({ pendingReceiptId: receiptId, transition: "prepared" })
    );
    vi.mocked(getAuthzedActivationReceipt).mockResolvedValue(
      receipt({
        bridgeImageDigest: digest("1"),
        bridgeManifestDigest: digest("a"),
        candidateImageDigest: digest("2"),
        candidateManifestDigest: digest("9"),
        kind: "upgrade",
      })
    );

    await expect(
      prepareAuthzedActivation({
        bridgeImageDigest: digest("1"),
        bridgeManifestDigest: digest("a"),
        candidateImageDigest: digest("2"),
        candidateManifestDigest: digest("3"),
      })
    ).rejects.toMatchObject({
      code: "authzed_activation_manifest_mismatch",
      operation: "activation_prepare_existing_receipt",
    });

    expect(acquireAuthzedPreparationLease).not.toHaveBeenCalled();
  });

  test("renews its preparation lease while schema work is still running", async () => {
    vi.useFakeTimers();
    let finishSchema!: (value: Readonly<{ sourceDigest: `sha256:${string}` }>) => void;
    const applySchema = vi.fn(
      () =>
        new Promise<Readonly<{ sourceDigest: `sha256:${string}` }>>((resolve) => {
          finishSchema = resolve;
        })
    );
    const preparation = prepareAuthzedActivation(
      {
        bridgeImageDigest: digest("1"),
        bridgeManifestDigest: digest("a"),
        candidateImageDigest: digest("2"),
        candidateManifestDigest: digest("3"),
      },
      {
        applySchema: applySchema as never,
        audit: vi.fn(async (mode) => ({ ...cleanAudit, mode })),
        checkSchema: vi.fn(async () => ({ status: "matched" }) as never),
        drainOutbox: vi.fn(async () => ({
          claimed: 0,
          deadLettered: 0,
          delivered: 0,
          failed: 0,
          remaining: 0,
          status: "drained" as const,
        })),
        getOutboxStatus: vi.fn(async () => ({
          deadLettered: 0,
          oldestPendingAgeSeconds: null,
          overdueRevocations: 0,
          pending: 0,
          revocationsPastCritical: 0,
          revocationsPastWarning: 0,
        })),
      }
    );

    await vi.advanceTimersByTimeAsync(60_000);
    expect(renewAuthzedPreparationLease).toHaveBeenCalledOnce();

    finishSchema({ sourceDigest: digest("c") });
    await expect(preparation).resolves.toBe(receiptId);
    expect(createPreparedAuthzedActivationReceipt).toHaveBeenCalledOnce();
  });
});

describe("AuthZed activation final evidence", () => {
  const dependencies = (schemaStatus: "matched" | "drifted") => ({
    audit: vi.fn(async (mode: "apply" | "dry_run") => ({ ...cleanAudit, mode })),
    checkSchema: vi.fn(async () => ({ status: schemaStatus }) as never),
    drainOutbox: vi.fn(async () => ({
      claimed: 0,
      deadLettered: 0,
      delivered: 0,
      failed: 0,
      remaining: 0,
      status: "drained" as const,
    })),
    getOutboxStatus: vi.fn(async () => ({
      deadLettered: 0,
      oldestPendingAgeSeconds: null,
      overdueRevocations: 0,
      pending: 0,
      revocationsPastCritical: 0,
      revocationsPastWarning: 0,
    })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("blocks the authority switch when the live schema drifted after preparation", async () => {
    vi.mocked(readAuthzedReleaseManifest).mockResolvedValue({ authorizationMode: "legacy_bridge" } as never);
    vi.mocked(activateAuthzedAuthorization).mockImplementation(async (_receipt, _manifest, collect) => {
      await collect(new AbortController().signal);
    });

    await expect(
      activatePreparedAuthzedAuthorization(receiptId, dependencies("drifted"))
    ).rejects.toMatchObject({
      code: "authzed_activation_graph_dirty",
      operation: "activation_schema_verify",
    });
  });

  test("keeps the mutation fence when the live schema drifts before finalization", async () => {
    vi.mocked(readAuthzedReleaseManifest).mockResolvedValue({
      authorizationMode: "spicedb_authoritative",
    } as never);
    vi.mocked(finalizeAuthzedActivation).mockImplementation(async (_receipt, _manifest, collect) => {
      await collect(new AbortController().signal);
    });

    await expect(
      finalizePreparedAuthzedAuthorization(receiptId, dependencies("drifted"))
    ).rejects.toMatchObject({
      code: "authzed_activation_graph_dirty",
      operation: "activation_schema_verify",
    });
  });
});
