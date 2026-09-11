import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  activateAuthzedAuthorization,
  completeAuthzedRollback,
  finalizeAuthzedActivation,
  getLatestAuthzedSourceSequence,
} from "./activation-repository";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock("@formbricks/database", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://formbricks:secret@postgres:5432/formbricks?connection_limit=2",
  },
}));

const receiptId = "5d847b79-ae35-45d0-9dc5-595c1ccbdf61";
const manifestDigest = `sha256:${"a".repeat(64)}` as const;

const control = (overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> => ({
  activeReceiptId: null,
  authority: "legacy",
  generation: 1n,
  maintenanceLeaseActive: false,
  maintenanceLeaseExpiresAt: null,
  maintenanceLeaseOwner: null,
  mutationFenceActive: false,
  mutationFenceExpiresAt: null,
  pendingReceiptId: receiptId,
  transition: "prepared",
  ...overrides,
});

const receipt = (overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> => ({
  bridgeImageDigest: `sha256:${"b".repeat(64)}`,
  bridgeManifestDigest: manifestDigest,
  candidateImageDigest: `sha256:${"c".repeat(64)}`,
  candidateManifestDigest: `sha256:${"d".repeat(64)}`,
  clientConfigDigest: `sha256:${"e".repeat(64)}`,
  contractDigest: `sha256:${"f".repeat(64)}`,
  generation: 1n,
  id: receiptId,
  kind: "upgrade",
  protocolVersion: 1,
  schemaDigest: `sha256:${"0".repeat(64)}`,
  status: "prepared",
  ...overrides,
});

type TTransaction = Readonly<{
  $executeRaw: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  authzedActivationReceipt: Readonly<{ update: ReturnType<typeof vi.fn> }>;
}>;

const transaction = (...queryResults: ReadonlyArray<unknown>): TTransaction => {
  const pendingResults = [...queryResults];
  return {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async () => [pendingResults.shift()]),
    authzedActivationReceipt: { update: vi.fn(async () => undefined) },
  };
};

const useTransactions = (...transactions: ReadonlyArray<TTransaction>): void => {
  const pending = [...transactions];
  prisma.$transaction.mockImplementation(async (callback: (tx: TTransaction) => Promise<unknown>) => {
    const tx = pending.shift();
    if (!tx) throw new Error("unexpected transaction");
    return callback(tx);
  });
};

describe("AuthZed activation repository recovery", () => {
  beforeEach(() => vi.clearAllMocks());

  test("reads the source watermark from the sequence without scanning retained outbox history", async () => {
    prisma.$queryRaw.mockResolvedValue([{ sourceSequence: 81n }]);

    await expect(getLatestAuthzedSourceSequence()).resolves.toBe(81n);

    const query = (prisma.$queryRaw.mock.calls[0]?.[0] as ReadonlyArray<string>).join(" ");
    expect(query).toContain(`nextval('"AuthzedProjectionOutbox_sourceSequence_seq"')`);
    expect(query).not.toContain("MAX");
    expect(query).not.toContain("last_value");
    expect(query).not.toContain('FROM "AuthzedProjectionOutbox"');
  });

  test("treats an already committed authority switch as an idempotent success", async () => {
    const tx = transaction(
      control({
        activeReceiptId: receiptId,
        authority: "spicedb",
        pendingReceiptId: null,
        transition: "idle",
      }),
      receipt({ status: "active" })
    );
    useTransactions(tx);
    const collectEvidence = vi.fn();

    await expect(
      activateAuthzedAuthorization(receiptId, manifestDigest, collectEvidence)
    ).resolves.toBeUndefined();

    expect(collectEvidence).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  test("does not steal an unexpired mutation fence", async () => {
    const tx = transaction(control({ mutationFenceActive: true, transition: "activating" }), receipt());
    useTransactions(tx);

    await expect(activateAuthzedAuthorization(receiptId, manifestDigest, vi.fn())).rejects.toMatchObject({
      code: "authzed_activation_conflict",
      operation: "activation_activate",
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  test("reacquires an expired fence and completes the authority switch", async () => {
    const fenceTx = transaction(control({ transition: "activating" }), receipt());
    const authorityTx = transaction(
      control({ mutationFenceActive: true, transition: "activating" }),
      receipt()
    );
    useTransactions(fenceTx, authorityTx);
    const collectEvidence = vi.fn(async () => ({
      auditCounters: { missing: 0 },
      completedAtSnapshot: "snapshot",
      outboxCounters: { pending: 0 },
      sourceSequenceWatermark: 8n,
    }));

    await expect(
      activateAuthzedAuthorization(receiptId, manifestDigest, collectEvidence)
    ).resolves.toBeUndefined();

    expect(fenceTx.$executeRaw).toHaveBeenCalledOnce();
    expect(fenceTx.$executeRaw.mock.calls[0]).toContain(899);
    expect(collectEvidence).toHaveBeenCalledOnce();
    expect(authorityTx.authzedActivationReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: receiptId },
        data: expect.objectContaining({ status: "active" }),
      })
    );
    expect(authorityTx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  test("treats an already finalized candidate as an idempotent success", async () => {
    const tx = transaction(
      control({
        activeReceiptId: receiptId,
        authority: "spicedb",
        pendingReceiptId: null,
        transition: "idle",
      }),
      receipt({ status: "active" })
    );
    useTransactions(tx);
    const collectEvidence = vi.fn();

    await expect(
      finalizeAuthzedActivation(receiptId, `sha256:${"d".repeat(64)}`, collectEvidence)
    ).resolves.toBeUndefined();

    expect(collectEvidence).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  test("treats an already completed rollback as an idempotent success", async () => {
    const tx = transaction(
      control({ authority: "legacy", pendingReceiptId: null, transition: "idle" }),
      receipt({ status: "rolled_back" })
    );
    useTransactions(tx);

    await expect(completeAuthzedRollback(receiptId, manifestDigest)).resolves.toBeUndefined();

    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.authzedActivationReceipt.update).not.toHaveBeenCalled();
  });
});
