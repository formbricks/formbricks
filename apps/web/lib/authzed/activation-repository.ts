import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { env } from "@/lib/env";
import {
  assertAuthzedActivationDatabasePoolCapacity,
  runAuthzedActivationWithTimeout,
} from "./activation-safety";
import {
  AUTHZED_ACTIVATION_CONTROL_ID,
  AUTHZED_ACTIVATION_FINALIZATION_SETTLEMENT_GRACE_MS,
  AUTHZED_ACTIVATION_FINALIZATION_TIMEOUT_MS,
  AUTHZED_ACTIVATION_PROTOCOL_VERSION,
  type TAuthzedActivationEvidence,
  type TAuthzedActivationKind,
  type TAuthzedActivationReceiptInput,
  type TAuthzedActivationReceiptStatus,
  type TAuthzedActivationStatus,
  type TAuthzedDigest,
} from "./activation-types";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

const AUTHZED_ADVISORY_LOCK_NAMESPACE = 1_179_402_834;
const AUTHZED_ADVISORY_LOCK_KEY = 6;
// The database stores the fence at millisecond precision while clock_timestamp() has finer precision.
// Leave a full-second margin below the trigger's 15-minute ceiling so timestamp rounding cannot reject
// an otherwise valid fence nondeterministically.
const AUTHZED_MUTATION_FENCE_DURATION_SECONDS = 14 * 60 + 59;

type TControlRow = Readonly<{
  activeReceiptId: string | null;
  authority: TAuthzedActivationStatus["authority"];
  generation: bigint;
  maintenanceLeaseActive: boolean;
  maintenanceLeaseExpiresAt: Date | null;
  maintenanceLeaseOwner: string | null;
  mutationFenceActive: boolean;
  mutationFenceExpiresAt: Date | null;
  pendingReceiptId: string | null;
  transition: TAuthzedActivationStatus["transition"];
}>;

export type TAuthzedActivationReceiptRecord = Readonly<{
  bridgeImageDigest: string | null;
  bridgeManifestDigest: string | null;
  candidateImageDigest: string | null;
  candidateManifestDigest: string;
  clientConfigDigest: string;
  contractDigest: string;
  generation: bigint;
  id: string;
  kind: TAuthzedActivationKind;
  protocolVersion: number;
  schemaDigest: string;
  status: TAuthzedActivationReceiptStatus;
}>;

type TActivationFailureCode =
  | typeof AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT
  | typeof AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED;

const activationError = (code: TActivationFailureCode, operation: string): AuthzedError =>
  new AuthzedError({ attempts: 0, code, operation, retryable: false });

const assertOne = (count: number, operation: string): void => {
  if (count !== 1) throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, operation);
};

const json = (value: Readonly<Record<string, number | null>>): Prisma.InputJsonValue => ({ ...value });

const lockControl = async (tx: Prisma.TransactionClient): Promise<TControlRow> => {
  const [control] = await tx.$queryRaw<TControlRow[]>`
    SELECT "authority", "transition", "generation", "pendingReceiptId", "activeReceiptId",
           "mutationFenceExpiresAt", "maintenanceLeaseOwner", "maintenanceLeaseExpiresAt",
           COALESCE("mutationFenceExpiresAt" > clock_timestamp(), false) AS "mutationFenceActive",
           COALESCE("maintenanceLeaseExpiresAt" > clock_timestamp(), false) AS "maintenanceLeaseActive"
    FROM "AuthzedAuthorizationControl"
    WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
    FOR UPDATE
  `;
  if (!control) throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED, "activation_control_read");
  return control;
};

const readReceipt = async (
  tx: Prisma.TransactionClient,
  receiptId: string
): Promise<TAuthzedActivationReceiptRecord> => {
  const [receipt] = await tx.$queryRaw<TAuthzedActivationReceiptRecord[]>`
    SELECT "id", "generation", "kind", "status", "protocolVersion", "contractDigest", "schemaDigest",
           "clientConfigDigest", "bridgeImageDigest", "bridgeManifestDigest",
           "candidateImageDigest", "candidateManifestDigest"
    FROM "AuthzedActivationReceipt"
    WHERE "id" = ${receiptId}
  `;
  if (!receipt) throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED, "activation_receipt_read");
  return receipt;
};

export const getLatestAuthzedSourceSequence = async (): Promise<bigint> => {
  const [row] = await prisma.$queryRaw<Array<{ sourceSequence: bigint | null }>>`
    SELECT nextval('"AuthzedProjectionOutbox_sourceSequence_seq"') AS "sourceSequence"
  `;
  return row?.sourceSequence ?? 0n;
};

export const getAuthzedActivationStatus = async (): Promise<TAuthzedActivationStatus> => {
  const [control] = await prisma.$queryRaw<TControlRow[]>`
    SELECT "authority", "transition", "generation", "pendingReceiptId", "activeReceiptId",
           "mutationFenceExpiresAt", "maintenanceLeaseOwner", "maintenanceLeaseExpiresAt",
           COALESCE("mutationFenceExpiresAt" > clock_timestamp(), false) AS "mutationFenceActive",
           COALESCE("maintenanceLeaseExpiresAt" > clock_timestamp(), false) AS "maintenanceLeaseActive"
    FROM "AuthzedAuthorizationControl"
    WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
  `;
  if (!control) throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_REQUIRED, "activation_status");
  return {
    activeReceiptId: control.activeReceiptId,
    authority: control.authority,
    fenceActive: control.mutationFenceActive,
    generation: control.generation,
    pendingReceiptId: control.pendingReceiptId,
    transition: control.transition,
  };
};

export const acquireAuthzedPreparationLease = async (leaseOwner: string): Promise<void> => {
  const count = await prisma.$executeRaw`
    UPDATE "AuthzedAuthorizationControl"
    SET "transition" = 'preparing'::"AuthzedAuthorizationTransition",
        "maintenanceLeaseOwner" = ${leaseOwner},
        "maintenanceLeaseExpiresAt" = clock_timestamp() + INTERVAL '5 minutes',
        "updatedAt" = clock_timestamp()
    WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
      AND "authority" = 'legacy'::"AuthzedAuthorizationAuthority"
      AND (
        "transition" = 'idle'::"AuthzedAuthorizationTransition"
        OR (
          "transition" = 'preparing'::"AuthzedAuthorizationTransition"
          AND (
            "maintenanceLeaseExpiresAt" <= clock_timestamp()
            OR "maintenanceLeaseOwner" = ${leaseOwner}
          )
        )
      )
  `;
  assertOne(count, "activation_prepare_lease");
};

export const renewAuthzedPreparationLease = async (leaseOwner: string): Promise<void> => {
  const count = await prisma.$executeRaw`
    UPDATE "AuthzedAuthorizationControl"
    SET "maintenanceLeaseExpiresAt" = clock_timestamp() + INTERVAL '5 minutes',
        "updatedAt" = clock_timestamp()
    WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
      AND "authority" = 'legacy'::"AuthzedAuthorizationAuthority"
      AND "transition" = 'preparing'::"AuthzedAuthorizationTransition"
      AND "maintenanceLeaseOwner" = ${leaseOwner}
      AND "maintenanceLeaseExpiresAt" > clock_timestamp()
  `;
  assertOne(count, "activation_prepare_lease_renew");
};

export const abandonAuthzedPreparation = async (leaseOwner: string): Promise<void> => {
  await prisma.authzedAuthorizationControl.updateMany({
    where: {
      authority: "legacy",
      id: AUTHZED_ACTIVATION_CONTROL_ID,
      maintenanceLeaseOwner: leaseOwner,
      transition: "preparing",
    },
    data: { maintenanceLeaseExpiresAt: null, maintenanceLeaseOwner: null, transition: "idle" },
  });
};

export const createPreparedAuthzedActivationReceipt = async (
  input: TAuthzedActivationReceiptInput,
  leaseOwner: string
): Promise<string> =>
  prisma.$transaction(
    async (tx) => {
      const control = await lockControl(tx);
      if (
        control.authority !== "legacy" ||
        control.transition !== "preparing" ||
        control.maintenanceLeaseOwner !== leaseOwner ||
        !control.maintenanceLeaseActive
      ) {
        throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_prepare_state");
      }

      const receiptId = randomUUID();
      const generation = control.generation + 1n;
      await tx.authzedActivationReceipt.create({
        data: {
          ...input,
          auditCounters: json(input.auditCounters),
          generation,
          id: receiptId,
          outboxCounters: json(input.outboxCounters),
          protocolVersion: AUTHZED_ACTIVATION_PROTOCOL_VERSION,
          status: "prepared",
        },
      });
      const updated = await tx.authzedAuthorizationControl.updateMany({
        where: {
          authority: "legacy",
          generation: control.generation,
          id: AUTHZED_ACTIVATION_CONTROL_ID,
          maintenanceLeaseOwner: leaseOwner,
          transition: "preparing",
        },
        data: {
          activeReceiptId: null,
          generation,
          maintenanceLeaseExpiresAt: null,
          maintenanceLeaseOwner: null,
          pendingReceiptId: receiptId,
          transition: "prepared",
        },
      });
      assertOne(updated.count, "activation_prepare_cas");
      return receiptId;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

const resetFailedActivation = async (receiptId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const control = await lockControl(tx);
    if (
      control.authority !== "legacy" ||
      control.pendingReceiptId !== receiptId ||
      control.transition !== "activating"
    ) {
      return;
    }
    const updated = await tx.authzedAuthorizationControl.updateMany({
      where: {
        authority: "legacy",
        generation: control.generation,
        id: AUTHZED_ACTIVATION_CONTROL_ID,
        pendingReceiptId: receiptId,
        transition: "activating",
      },
      data: { mutationFenceExpiresAt: null, transition: "prepared" },
    });
    assertOne(updated.count, "activation_reset_cas");
  });
};

/** Fence source mutations, verify the final graph, and make SpiceDB authoritative atomically. */
export const activateAuthzedAuthorization = async (
  receiptId: string,
  runtimeManifestDigest: TAuthzedDigest,
  collectFinalEvidence: (signal: AbortSignal) => Promise<TAuthzedActivationEvidence>
): Promise<void> => {
  assertAuthzedActivationDatabasePoolCapacity(env.DATABASE_URL);
  const activationRequired = await prisma.$transaction(async (tx) => {
    const control = await lockControl(tx);
    const receipt = await readReceipt(tx, receiptId);
    const manifestMatches =
      receipt.kind === "upgrade"
        ? receipt.bridgeManifestDigest === runtimeManifestDigest
        : receipt.candidateManifestDigest === runtimeManifestDigest;

    if (
      control.authority === "spicedb" &&
      (control.transition === "activating" || control.transition === "idle") &&
      control.activeReceiptId === receiptId &&
      receipt.status === "active" &&
      receipt.generation === control.generation &&
      receipt.protocolVersion === AUTHZED_ACTIVATION_PROTOCOL_VERSION &&
      manifestMatches
    ) {
      // The authority transaction may have committed even when the caller lost its response. Treat the
      // exact active receipt as success so an immutable activation phase can be safely rerun.
      return false;
    }

    const resumableTransition =
      control.transition === "prepared" ||
      (control.transition === "activating" && !control.mutationFenceActive);
    if (
      control.authority !== "legacy" ||
      !resumableTransition ||
      control.pendingReceiptId !== receiptId ||
      receipt.status !== "prepared" ||
      receipt.generation !== control.generation ||
      receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
      !manifestMatches
    ) {
      throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_activate");
    }
    const count = await tx.$executeRaw`
      UPDATE "AuthzedAuthorizationControl"
      SET "mutationFenceExpiresAt" = clock_timestamp() +
            (${AUTHZED_MUTATION_FENCE_DURATION_SECONDS} * INTERVAL '1 second'),
          "transition" = 'activating'::"AuthzedAuthorizationTransition",
          "updatedAt" = clock_timestamp()
      WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
        AND "authority" = 'legacy'::"AuthzedAuthorizationAuthority"
        AND "generation" = ${control.generation}
        AND "pendingReceiptId" = ${receiptId}
        AND (
          "transition" = 'prepared'::"AuthzedAuthorizationTransition"
          OR (
            "transition" = 'activating'::"AuthzedAuthorizationTransition"
            AND (
              "mutationFenceExpiresAt" IS NULL
              OR "mutationFenceExpiresAt" <= clock_timestamp()
            )
          )
        )
    `;
    assertOne(count, "activation_fence_cas");
    return true;
  });

  if (!activationRequired) return;

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(${AUTHZED_ADVISORY_LOCK_NAMESPACE}, ${AUTHZED_ADVISORY_LOCK_KEY})
        `;
        const evidence = await runAuthzedActivationWithTimeout(collectFinalEvidence);
        const control = await lockControl(tx);
        if (
          control.authority !== "legacy" ||
          control.transition !== "activating" ||
          control.pendingReceiptId !== receiptId ||
          !control.mutationFenceActive
        ) {
          throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_evidence_state");
        }
        const receipt = await readReceipt(tx, receiptId);
        if (receipt.status !== "prepared" || receipt.generation !== control.generation) {
          throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_evidence_receipt");
        }
        await tx.authzedActivationReceipt.update({
          where: { id: receiptId },
          data: {
            activatedAt: new Date(),
            auditCounters: json(evidence.auditCounters),
            completedAtSnapshot: evidence.completedAtSnapshot,
            outboxCounters: json(evidence.outboxCounters),
            sourceSequenceWatermark: evidence.sourceSequenceWatermark,
            status: "active",
          },
        });
        const count = await tx.$executeRaw`
          UPDATE "AuthzedAuthorizationControl"
          SET "activeReceiptId" = ${receiptId},
              "authority" = 'spicedb'::"AuthzedAuthorizationAuthority",
              "mutationFenceExpiresAt" = clock_timestamp() +
                (${AUTHZED_MUTATION_FENCE_DURATION_SECONDS} * INTERVAL '1 second'),
              "pendingReceiptId" = NULL,
              "updatedAt" = clock_timestamp()
          WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
            AND "authority" = 'legacy'::"AuthzedAuthorizationAuthority"
            AND "generation" = ${control.generation}
            AND "pendingReceiptId" = ${receiptId}
            AND "transition" = 'activating'::"AuthzedAuthorizationTransition"
        `;
        assertOne(count, "activation_authority_cas");
      },
      {
        timeout:
          AUTHZED_ACTIVATION_FINALIZATION_TIMEOUT_MS + AUTHZED_ACTIVATION_FINALIZATION_SETTLEMENT_GRACE_MS,
      }
    );
  } catch (error) {
    await resetFailedActivation(receiptId);
    throw error;
  }
};

export const finalizeAuthzedActivation = async (
  receiptId: string,
  candidateManifestDigest: TAuthzedDigest,
  collectFinalEvidence: (signal: AbortSignal) => Promise<TAuthzedActivationEvidence>
): Promise<void> => {
  assertAuthzedActivationDatabasePoolCapacity(env.DATABASE_URL);
  // The candidate validation window can legitimately outlive the original 15-minute fence. Renew it
  // before finalization so a slow rollout always has a safe forward path instead of becoming wedged.
  const finalizationRequired = await prisma.$transaction(async (tx) => {
    const control = await lockControl(tx);
    const receipt = await readReceipt(tx, receiptId);

    if (
      control.authority === "spicedb" &&
      control.transition === "idle" &&
      control.activeReceiptId === receiptId &&
      receipt.status === "active" &&
      receipt.generation === control.generation &&
      receipt.protocolVersion === AUTHZED_ACTIVATION_PROTOCOL_VERSION &&
      receipt.candidateManifestDigest === candidateManifestDigest
    ) {
      // Finalization may have committed even when its response was lost. The exact active receipt is
      // durable proof that the requested candidate already completed this phase.
      return false;
    }

    if (
      control.authority !== "spicedb" ||
      control.transition !== "activating" ||
      control.activeReceiptId !== receiptId ||
      receipt.status !== "active" ||
      receipt.generation !== control.generation ||
      receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
      receipt.candidateManifestDigest !== candidateManifestDigest
    ) {
      throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_finalize");
    }
    const count = await tx.$executeRaw`
      UPDATE "AuthzedAuthorizationControl"
      SET "mutationFenceExpiresAt" = clock_timestamp() +
            (${AUTHZED_MUTATION_FENCE_DURATION_SECONDS} * INTERVAL '1 second'),
          "updatedAt" = clock_timestamp()
      WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
        AND "activeReceiptId" = ${receiptId}
        AND "authority" = 'spicedb'::"AuthzedAuthorizationAuthority"
        AND "generation" = ${control.generation}
        AND "transition" = 'activating'::"AuthzedAuthorizationTransition"
    `;
    assertOne(count, "activation_finalize_fence_cas");
    return true;
  });

  if (!finalizationRequired) return;

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(${AUTHZED_ADVISORY_LOCK_NAMESPACE}, ${AUTHZED_ADVISORY_LOCK_KEY})
      `;
      const evidence = await runAuthzedActivationWithTimeout(collectFinalEvidence);
      const control = await lockControl(tx);
      const receipt = await readReceipt(tx, receiptId);
      if (
        control.authority !== "spicedb" ||
        control.transition !== "activating" ||
        control.activeReceiptId !== receiptId ||
        !control.mutationFenceActive ||
        receipt.status !== "active" ||
        receipt.generation !== control.generation ||
        receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
        receipt.candidateManifestDigest !== candidateManifestDigest
      ) {
        throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_finalize_state");
      }
      await tx.authzedActivationReceipt.update({
        where: { id: receiptId },
        data: {
          auditCounters: json(evidence.auditCounters),
          completedAtSnapshot: evidence.completedAtSnapshot,
          outboxCounters: json(evidence.outboxCounters),
          sourceSequenceWatermark: evidence.sourceSequenceWatermark,
        },
      });
      const updated = await tx.authzedAuthorizationControl.updateMany({
        where: {
          activeReceiptId: receiptId,
          authority: "spicedb",
          generation: control.generation,
          id: AUTHZED_ACTIVATION_CONTROL_ID,
          transition: "activating",
        },
        data: {
          maintenanceLeaseExpiresAt: null,
          maintenanceLeaseOwner: null,
          mutationFenceExpiresAt: null,
          transition: "idle",
        },
      });
      assertOne(updated.count, "activation_finalize_cas");
    },
    {
      timeout:
        AUTHZED_ACTIVATION_FINALIZATION_TIMEOUT_MS + AUTHZED_ACTIVATION_FINALIZATION_SETTLEMENT_GRACE_MS,
    }
  );
};

/** Recover a bridge-side activation abandoned before authority changed and after its fence expired. */
export const recoverExpiredFreshAuthzedActivation = async (
  receiptId: string,
  candidateManifestDigest: TAuthzedDigest
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const control = await lockControl(tx);
    const receipt = await readReceipt(tx, receiptId);
    if (
      control.authority !== "legacy" ||
      control.transition !== "activating" ||
      control.pendingReceiptId !== receiptId ||
      control.mutationFenceActive ||
      receipt.kind !== "fresh_install" ||
      receipt.status !== "prepared" ||
      receipt.generation !== control.generation ||
      receipt.candidateManifestDigest !== candidateManifestDigest
    ) {
      throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_recover_fresh");
    }
    const updated = await tx.authzedAuthorizationControl.updateMany({
      where: {
        authority: "legacy",
        generation: control.generation,
        id: AUTHZED_ACTIVATION_CONTROL_ID,
        pendingReceiptId: receiptId,
        transition: "activating",
      },
      data: { mutationFenceExpiresAt: null, transition: "prepared" },
    });
    assertOne(updated.count, "activation_recover_fresh_cas");
  });
};

export const abortAuthzedActivation = async (receiptId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const control = await lockControl(tx);
    if (
      control.authority !== "legacy" ||
      control.transition !== "prepared" ||
      control.pendingReceiptId !== receiptId
    ) {
      throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_abort");
    }
    assertOne(
      (
        await tx.authzedActivationReceipt.updateMany({
          where: { generation: control.generation, id: receiptId, status: "prepared" },
          data: { invalidatedAt: new Date(), status: "invalidated" },
        })
      ).count,
      "activation_abort_receipt_cas"
    );
    const updated = await tx.authzedAuthorizationControl.updateMany({
      where: {
        authority: "legacy",
        generation: control.generation,
        id: AUTHZED_ACTIVATION_CONTROL_ID,
        pendingReceiptId: receiptId,
        transition: "prepared",
      },
      data: { mutationFenceExpiresAt: null, pendingReceiptId: null, transition: "idle" },
    });
    assertOne(updated.count, "activation_abort_cas");
  });
};

export const beginAuthzedRollback = async (receiptId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const control = await lockControl(tx);
    const receipt = await readReceipt(tx, receiptId);
    if (
      control.authority !== "spicedb" ||
      !["activating", "idle", "rollback_fencing", "rolling_back"].includes(control.transition) ||
      control.activeReceiptId !== receiptId ||
      receipt.kind !== "upgrade" ||
      receipt.status !== "active" ||
      receipt.generation !== control.generation
    ) {
      throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_rollback_begin");
    }
    const count = await tx.$executeRaw`
      UPDATE "AuthzedAuthorizationControl"
      SET "mutationFenceExpiresAt" = clock_timestamp() +
            (${AUTHZED_MUTATION_FENCE_DURATION_SECONDS} * INTERVAL '1 second'),
          "transition" = 'rollback_fencing'::"AuthzedAuthorizationTransition",
          "updatedAt" = clock_timestamp()
      WHERE "id" = ${AUTHZED_ACTIVATION_CONTROL_ID}
        AND "activeReceiptId" = ${receiptId}
        AND "authority" = 'spicedb'::"AuthzedAuthorizationAuthority"
        AND "generation" = ${control.generation}
        AND "transition" IN (
          'activating'::"AuthzedAuthorizationTransition",
          'idle'::"AuthzedAuthorizationTransition",
          'rollback_fencing'::"AuthzedAuthorizationTransition",
          'rolling_back'::"AuthzedAuthorizationTransition"
        )
    `;
    assertOne(count, "activation_rollback_begin_cas");
  });

  // If this fails, deliberately retain the fence and rollback_fencing state. A retry can renew the
  // fence and resume; clearing it could allow writes before either authority is safely serving.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(${AUTHZED_ADVISORY_LOCK_NAMESPACE}, ${AUTHZED_ADVISORY_LOCK_KEY})
      `;
      const control = await lockControl(tx);
      const receipt = await readReceipt(tx, receiptId);
      if (
        control.authority !== "spicedb" ||
        control.transition !== "rollback_fencing" ||
        control.activeReceiptId !== receiptId ||
        !control.mutationFenceActive ||
        receipt.kind !== "upgrade" ||
        receipt.status !== "active" ||
        receipt.generation !== control.generation
      ) {
        throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_rollback_fence");
      }
      const updated = await tx.authzedAuthorizationControl.updateMany({
        where: {
          activeReceiptId: receiptId,
          authority: "spicedb",
          generation: control.generation,
          id: AUTHZED_ACTIVATION_CONTROL_ID,
          transition: "rollback_fencing",
        },
        data: { transition: "rolling_back" },
      });
      assertOne(updated.count, "activation_rollback_ready_cas");
    },
    { timeout: AUTHZED_ACTIVATION_FINALIZATION_TIMEOUT_MS + 30_000 }
  );
};

export const completeAuthzedRollback = async (
  receiptId: string,
  bridgeManifestDigest: TAuthzedDigest
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const control = await lockControl(tx);
    const receipt = await readReceipt(tx, receiptId);

    if (
      control.authority === "legacy" &&
      control.transition === "idle" &&
      control.activeReceiptId === null &&
      receipt.kind === "upgrade" &&
      receipt.status === "rolled_back" &&
      receipt.generation === control.generation &&
      receipt.protocolVersion === AUTHZED_ACTIVATION_PROTOCOL_VERSION &&
      receipt.bridgeManifestDigest === bridgeManifestDigest
    ) {
      // The rollback transaction may have committed even when its response was lost. An exact rolled-back
      // receipt is sufficient to make the immutable phase safely repeatable.
      return;
    }

    if (
      control.authority !== "spicedb" ||
      control.transition !== "rolling_back" ||
      control.activeReceiptId !== receiptId ||
      !control.mutationFenceActive ||
      receipt.kind !== "upgrade" ||
      receipt.status !== "active" ||
      receipt.generation !== control.generation ||
      receipt.protocolVersion !== AUTHZED_ACTIVATION_PROTOCOL_VERSION ||
      receipt.bridgeManifestDigest !== bridgeManifestDigest
    ) {
      throw activationError(AUTHZED_ERROR_CODES.ACTIVATION_CONFLICT, "activation_rollback_complete");
    }
    await tx.authzedActivationReceipt.update({
      where: { id: receiptId },
      data: { rolledBackAt: new Date(), status: "rolled_back" },
    });
    const updated = await tx.authzedAuthorizationControl.updateMany({
      where: {
        activeReceiptId: receiptId,
        authority: "spicedb",
        generation: control.generation,
        id: AUTHZED_ACTIVATION_CONTROL_ID,
        transition: "rolling_back",
      },
      data: {
        activeReceiptId: null,
        authority: "legacy",
        mutationFenceExpiresAt: null,
        transition: "idle",
      },
    });
    assertOne(updated.count, "activation_rollback_complete_cas");
  });
};

export const getAuthzedActivationReceipt = async (
  receiptId: string
): Promise<TAuthzedActivationReceiptRecord> => prisma.$transaction((tx) => readReceipt(tx, receiptId));
