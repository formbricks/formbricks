import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";
import {
  getAuthzedAuthorizationContractDigest,
  getAuthzedClientConfigDigest,
  getCanonicalAuthzedSchemaDigest,
} from "./activation-contract";
import {
  abandonAuthzedPreparation,
  abortAuthzedActivation,
  acquireAuthzedPreparationLease,
  activateAuthzedAuthorization,
  beginAuthzedRollback,
  completeAuthzedRollback,
  createPreparedAuthzedActivationReceipt,
  finalizeAuthzedActivation,
  getAuthzedActivationReceipt,
  getAuthzedActivationStatus,
  getLatestAuthzedSourceSequence,
  recoverExpiredFreshAuthzedActivation,
  renewAuthzedPreparationLease,
} from "./activation-repository";
import { checkAuthzedRuntimeActivation } from "./activation-runtime";
import { runWithRenewingAuthzedPreparationLease, throwIfAuthzedActivationAborted } from "./activation-safety";
import type { TAuthzedActivationEvidence, TAuthzedDigest } from "./activation-types";
import { type TAuthzedBackfillApply, type TAuthzedBackfillResult, runAuthzedBackfill } from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import { closeAuthzedClient, configureAuthzedClientForBulkWork, getAuthzedClient } from "./client";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { checkAuthzedHealth } from "./health";
import { drainAuthzedOutbox } from "./outbox-processor";
import { getAuthzedOutboxStatus } from "./outbox-repository";
import type { TAuthzedOutboxStatus } from "./outbox-types";
import { createAuthzedReleaseManifestDigest, readAuthzedReleaseManifest } from "./release-manifest";
import { applyCanonicalAuthzedSchema, checkCanonicalAuthzedSchema } from "./schema";

type TPrepareInput = Readonly<{
  bridgeImageDigest: TAuthzedDigest;
  bridgeManifestDigest: TAuthzedDigest;
  candidateImageDigest: TAuthzedDigest;
  candidateManifestDigest: TAuthzedDigest;
  expectedCurrentDigest?: string;
}>;

type TReceiptIdentity =
  | Readonly<{
      bridgeImageDigest: null;
      bridgeManifestDigest: null;
      candidateImageDigest: null;
      candidateManifestDigest: TAuthzedDigest;
      kind: "fresh_install";
    }>
  | Readonly<{
      bridgeImageDigest: TAuthzedDigest;
      bridgeManifestDigest: TAuthzedDigest;
      candidateImageDigest: TAuthzedDigest;
      candidateManifestDigest: TAuthzedDigest;
      kind: "upgrade";
    }>;

type TActivationDependencies = Readonly<{
  applySchema: typeof applyCanonicalAuthzedSchema;
  audit: (
    mode: "apply" | "dry_run",
    apply: TAuthzedBackfillApply,
    signal?: AbortSignal
  ) => Promise<TAuthzedBackfillResult>;
  checkHealth: typeof checkAuthzedHealth;
  checkSchema: typeof checkCanonicalAuthzedSchema;
  countOrganizations: () => Promise<number>;
  drainOutbox: typeof drainAuthzedOutbox;
  getOutboxStatus: typeof getAuthzedOutboxStatus;
}>;

const defaultDependencies: TActivationDependencies = {
  applySchema: applyCanonicalAuthzedSchema,
  audit: (mode, apply, signal) =>
    runAuthzedBackfill(
      { maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN, mode, prune: false, scope: { kind: "all" } },
      { apply, client: getAuthzedClient(), signal }
    ),
  checkHealth: checkAuthzedHealth,
  checkSchema: checkCanonicalAuthzedSchema,
  countOrganizations: () => prisma.organization.count(),
  drainOutbox: drainAuthzedOutbox,
  getOutboxStatus: getAuthzedOutboxStatus,
};

const protocolError = (
  code:
    | typeof AUTHZED_ERROR_CODES.ACTIVATION_GRAPH_DIRTY
    | typeof AUTHZED_ERROR_CODES.ACTIVATION_MANIFEST_MISMATCH
    | typeof AUTHZED_ERROR_CODES.ACTIVATION_OUTBOX_PENDING
    | typeof AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
  operation: string
): AuthzedError => new AuthzedError({ attempts: 0, code, operation, retryable: false });

const isOutboxClean = (status: TAuthzedOutboxStatus): boolean =>
  status.deadLettered === 0 &&
  status.overdueRevocations === 0 &&
  status.pending === 0 &&
  status.revocationsPastCritical === 0 &&
  status.revocationsPastWarning === 0;

const summarizeOutbox = (status: TAuthzedOutboxStatus): Readonly<Record<string, number | null>> => ({
  deadLettered: status.deadLettered,
  oldestPendingAgeSeconds: status.oldestPendingAgeSeconds,
  overdueRevocations: status.overdueRevocations,
  pending: status.pending,
  revocationsPastCritical: status.revocationsPastCritical,
  revocationsPastWarning: status.revocationsPastWarning,
});

const assertConfiguration = (): void => {
  const enabled = env.AUTHZED_ENABLED === "true" || env.AUTHZED_ENABLED === "1";
  if (!enabled || env.AUTHZED_CONSISTENCY !== "fully_consistent") {
    throw protocolError(AUTHZED_ERROR_CODES.FAILED_PRECONDITION, "activation_configuration");
  }
};

const assertHealthy = async (dependencies: TActivationDependencies, signal?: AbortSignal): Promise<void> => {
  throwIfAuthzedActivationAborted(signal);
  if ((await dependencies.checkHealth()).status !== "healthy") {
    throw protocolError(AUTHZED_ERROR_CODES.FAILED_PRECONDITION, "activation_health");
  }
  throwIfAuthzedActivationAborted(signal);
};

const assertCleanAudit = (result: TAuthzedBackfillResult): void => {
  if (result.status !== "reconciled" || result.truncated || result.failures.length > 0) {
    throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_GRAPH_DIRTY, "activation_graph_audit");
  }
};

const reconcileAndAudit = async (
  dependencies: TActivationDependencies,
  signal?: AbortSignal
): Promise<Pick<TAuthzedActivationEvidence, "auditCounters" | "completedAtSnapshot">> => {
  throwIfAuthzedActivationAborted(signal);
  const reconciliation = await dependencies.audit("apply", createAuthzedBackfillApply(), signal);
  throwIfAuthzedActivationAborted(signal);
  if (reconciliation.status === "failed" || reconciliation.truncated) {
    throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_GRAPH_DIRTY, "activation_graph_reconcile");
  }
  const audit = await dependencies.audit("dry_run", createAuthzedBackfillNoopApply(), signal);
  throwIfAuthzedActivationAborted(signal);
  assertCleanAudit(audit);
  return { auditCounters: audit.counters, completedAtSnapshot: reconciliation.completedAtSnapshot };
};

const collectEvidence = async (
  dependencies: TActivationDependencies,
  throughSourceSequence?: bigint,
  signal?: AbortSignal
): Promise<TAuthzedActivationEvidence> => {
  throwIfAuthzedActivationAborted(signal);
  const sourceSequenceWatermark = throughSourceSequence ?? (await getLatestAuthzedSourceSequence());
  throwIfAuthzedActivationAborted(signal);
  const drain = await dependencies.drainOutbox({ signal, throughSourceSequence: sourceSequenceWatermark });
  throwIfAuthzedActivationAborted(signal);
  if (drain.status !== "drained" || drain.deadLettered > 0 || drain.failed > 0) {
    throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_OUTBOX_PENDING, "activation_outbox_drain");
  }
  const graph = await reconcileAndAudit(dependencies, signal);
  const outbox = await dependencies.getOutboxStatus(sourceSequenceWatermark);
  throwIfAuthzedActivationAborted(signal);
  if (!isOutboxClean(outbox)) {
    throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_OUTBOX_PENDING, "activation_outbox_verify");
  }
  return { ...graph, outboxCounters: summarizeOutbox(outbox), sourceSequenceWatermark };
};

const currentManifestDigest = async (expectedMode: "legacy_bridge" | "spicedb_authoritative") => {
  const manifest = await readAuthzedReleaseManifest();
  if (manifest.authorizationMode !== expectedMode) {
    throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_MANIFEST_MISMATCH, "activation_release_mode");
  }
  return createAuthzedReleaseManifestDigest(manifest);
};

const prepareAuthzedActivationReceipt = async (
  identity: TReceiptIdentity,
  expectedMode: "legacy_bridge" | "spicedb_authoritative",
  runtimeManifestDigest: TAuthzedDigest,
  expectedCurrentDigest: string | undefined,
  dependencyOverrides: Partial<TActivationDependencies> = {}
): Promise<string> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  assertConfiguration();
  const localManifestDigest = await currentManifestDigest(expectedMode);
  if (localManifestDigest !== runtimeManifestDigest) {
    throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_MANIFEST_MISMATCH, "activation_runtime_manifest");
  }

  const leaseOwner = randomUUID();
  await acquireAuthzedPreparationLease(leaseOwner);
  try {
    configureAuthzedClientForBulkWork();
    const receiptInput = await runWithRenewingAuthzedPreparationLease(
      async (signal) => {
        await assertHealthy(dependencies, signal);
        const schema = await dependencies.applySchema(expectedCurrentDigest);
        throwIfAuthzedActivationAborted(signal);
        const evidence = await collectEvidence(dependencies, undefined, signal);
        const [contractDigest, schemaDigest] = await Promise.all([
          Promise.resolve(getAuthzedAuthorizationContractDigest()),
          getCanonicalAuthzedSchemaDigest(),
        ]);
        throwIfAuthzedActivationAborted(signal);
        if (schema.sourceDigest !== schemaDigest || (await dependencies.checkSchema()).status !== "matched") {
          throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_GRAPH_DIRTY, "activation_schema_verify");
        }
        throwIfAuthzedActivationAborted(signal);

        return {
          ...evidence,
          ...identity,
          clientConfigDigest: getAuthzedClientConfigDigest(),
          contractDigest,
          schemaDigest,
        };
      },
      () => renewAuthzedPreparationLease(leaseOwner)
    );

    return await createPreparedAuthzedActivationReceipt(receiptInput, leaseOwner);
  } catch (error) {
    await abandonAuthzedPreparation(leaseOwner);
    throw error;
  } finally {
    closeAuthzedClient();
  }
};

export const prepareAuthzedActivation = async (
  input: TPrepareInput,
  dependencyOverrides: Partial<TActivationDependencies> = {}
): Promise<string> =>
  prepareAuthzedActivationReceipt(
    {
      bridgeImageDigest: input.bridgeImageDigest,
      bridgeManifestDigest: input.bridgeManifestDigest,
      candidateImageDigest: input.candidateImageDigest,
      candidateManifestDigest: input.candidateManifestDigest,
      kind: "upgrade",
    },
    "legacy_bridge",
    input.bridgeManifestDigest,
    input.expectedCurrentDigest,
    dependencyOverrides
  );

export const activatePreparedAuthzedAuthorization = async (
  receiptId: string,
  dependencyOverrides: Partial<TActivationDependencies> = {}
): Promise<void> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  assertConfiguration();
  const manifestDigest = await currentManifestDigest("legacy_bridge");
  configureAuthzedClientForBulkWork();
  try {
    await assertHealthy(dependencies);
    await activateAuthzedAuthorization(receiptId, manifestDigest, (signal) =>
      collectEvidence(dependencies, undefined, signal)
    );
  } finally {
    closeAuthzedClient();
  }
};

export const finalizePreparedAuthzedAuthorization = async (
  receiptId: string,
  dependencyOverrides: Partial<TActivationDependencies> = {}
): Promise<void> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  assertConfiguration();
  const manifestDigest = await currentManifestDigest("spicedb_authoritative");
  configureAuthzedClientForBulkWork();
  try {
    await assertHealthy(dependencies);
    await finalizeAuthzedActivation(receiptId, manifestDigest, (signal) =>
      collectEvidence(dependencies, undefined, signal)
    );
  } finally {
    closeAuthzedClient();
  }
};

export const rollbackAuthzedAuthorization = async (
  action: "begin" | "complete",
  receiptId: string
): Promise<void> => {
  if (action === "begin") {
    await beginAuthzedRollback(receiptId);
    return;
  }
  const manifestDigest = await currentManifestDigest("legacy_bridge");
  await completeAuthzedRollback(receiptId, manifestDigest);
};

export const bootstrapFreshAuthzedActivation = async (
  dependencyOverrides: Partial<TActivationDependencies> = {}
): Promise<void> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  assertConfiguration();
  const candidateManifestDigest = await currentManifestDigest("spicedb_authoritative");
  const status = await getAuthzedActivationStatus();

  if (status.authority === "spicedb") {
    if (status.transition === "activating" && status.activeReceiptId) {
      const receipt = await getAuthzedActivationReceipt(status.activeReceiptId);
      if (
        receipt.kind === "fresh_install" &&
        receipt.status === "active" &&
        receipt.generation === status.generation &&
        receipt.candidateManifestDigest === candidateManifestDigest
      ) {
        try {
          await finalizePreparedAuthzedAuthorization(receipt.id, dependencies);
        } catch (error) {
          // A concurrent idempotent bootstrap may have finalized first. Only accept the race when the
          // complete runtime invariant now proves this image safe.
          try {
            await checkAuthzedRuntimeActivation();
          } catch {
            throw error;
          }
        }
      }
    }
    await checkAuthzedRuntimeActivation();
    return;
  }

  if ((await dependencies.countOrganizations()) !== 0) {
    throw protocolError(AUTHZED_ERROR_CODES.FAILED_PRECONDITION, "activation_bootstrap_nonempty");
  }

  let receiptId: string;
  if ((status.transition === "prepared" || status.transition === "activating") && status.pendingReceiptId) {
    const receipt = await getAuthzedActivationReceipt(status.pendingReceiptId);
    if (
      receipt.kind !== "fresh_install" ||
      receipt.status !== "prepared" ||
      receipt.generation !== status.generation ||
      receipt.candidateManifestDigest !== candidateManifestDigest
    ) {
      throw protocolError(AUTHZED_ERROR_CODES.ACTIVATION_MANIFEST_MISMATCH, "activation_bootstrap_receipt");
    }
    if (status.transition === "activating") {
      if (status.fenceActive) {
        throw protocolError(AUTHZED_ERROR_CODES.FAILED_PRECONDITION, "activation_bootstrap_in_progress");
      }
      await recoverExpiredFreshAuthzedActivation(receipt.id, candidateManifestDigest);
    }
    receiptId = receipt.id;
  } else if (status.transition === "idle") {
    receiptId = await prepareAuthzedActivationReceipt(
      {
        bridgeImageDigest: null,
        bridgeManifestDigest: null,
        candidateImageDigest: null,
        candidateManifestDigest,
        kind: "fresh_install",
      },
      "spicedb_authoritative",
      candidateManifestDigest,
      undefined,
      dependencies
    );
  } else {
    throw protocolError(AUTHZED_ERROR_CODES.FAILED_PRECONDITION, "activation_bootstrap_state");
  }

  configureAuthzedClientForBulkWork();
  try {
    await activateAuthzedAuthorization(receiptId, candidateManifestDigest, (signal) =>
      collectEvidence(dependencies, undefined, signal)
    );
  } finally {
    closeAuthzedClient();
  }
  await finalizePreparedAuthzedAuthorization(receiptId, dependencies);
};

export { abortAuthzedActivation };
