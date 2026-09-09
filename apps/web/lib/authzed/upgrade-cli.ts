import "server-only";
import { env } from "@/lib/env";
import { type TAuthzedBackfillApply, type TAuthzedBackfillResult, runAuthzedBackfill } from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import { closeAuthzedClient, configureAuthzedClientForBulkWork, getAuthzedClient } from "./client";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError, type TAuthzedErrorCode, mapAuthzedError } from "./errors";
import { type TAuthzedHealthResult, checkAuthzedHealth } from "./health";
import { drainAuthzedOutbox } from "./outbox-processor";
import { getAuthzedOutboxStatus } from "./outbox-repository";
import type { TAuthzedOutboxDrainResult, TAuthzedOutboxStatus } from "./outbox-types";
import {
  type TAuthzedSchemaApplyResult,
  type TAuthzedSchemaCheckResult,
  applyCanonicalAuthzedSchema,
  checkCanonicalAuthzedSchema,
} from "./schema";
import type { TAuthzedUpgradeCliCommand } from "./upgrade-cli-command";

type TAuthzedUpgradeAudit = Readonly<{
  counters: TAuthzedBackfillResult["counters"];
  failureCount: number;
  status: TAuthzedBackfillResult["status"];
  truncated: boolean;
}>;

type TAuthzedUpgradeResult = Readonly<{
  audit?: TAuthzedUpgradeAudit;
  code?: TAuthzedErrorCode;
  datastoreMigrations?: "ready";
  health?: TAuthzedHealthResult;
  outbox?: TAuthzedOutboxStatus | TAuthzedOutboxDrainResult;
  retryable?: boolean;
  schema?: TAuthzedSchemaApplyResult | TAuthzedSchemaCheckResult;
  status: "blocked" | "failed" | "prepared" | "ready";
}>;

type TAuthzedUpgradeCliDependencies = Readonly<{
  applySchema: (expectedCurrentDigest?: string) => Promise<TAuthzedSchemaApplyResult>;
  audit: (mode: "apply" | "dry_run", apply: TAuthzedBackfillApply) => Promise<TAuthzedBackfillResult>;
  checkHealth: () => Promise<TAuthzedHealthResult>;
  checkSchema: () => Promise<TAuthzedSchemaCheckResult>;
  closeClient: () => void;
  configureBulkClient: () => void;
  consistency: () => string | undefined;
  drainOutbox: () => Promise<TAuthzedOutboxDrainResult>;
  isEnabled: () => boolean;
  outboxStatus: () => Promise<TAuthzedOutboxStatus>;
  writeOutput: (output: string) => void;
}>;

const runFullAudit = (mode: "apply" | "dry_run", apply: TAuthzedBackfillApply) =>
  runAuthzedBackfill(
    {
      maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
      mode,
      prune: false,
      scope: { kind: "all" },
    },
    { apply, client: getAuthzedClient() }
  );

const defaultDependencies: TAuthzedUpgradeCliDependencies = {
  applySchema: applyCanonicalAuthzedSchema,
  audit: runFullAudit,
  checkHealth: checkAuthzedHealth,
  checkSchema: checkCanonicalAuthzedSchema,
  closeClient: closeAuthzedClient,
  configureBulkClient: configureAuthzedClientForBulkWork,
  consistency: () => env.AUTHZED_CONSISTENCY,
  drainOutbox: drainAuthzedOutbox,
  isEnabled: () => env.AUTHZED_ENABLED === "true" || env.AUTHZED_ENABLED === "1",
  outboxStatus: getAuthzedOutboxStatus,
  writeOutput: (output) => process.stdout.write(output),
};

const summarizeAudit = (result: TAuthzedBackfillResult): TAuthzedUpgradeAudit => ({
  counters: result.counters,
  failureCount: result.failures.length,
  status: result.status,
  truncated: result.truncated,
});

const isOutboxClean = (status: TAuthzedOutboxStatus): boolean =>
  status.deadLettered === 0 &&
  status.overdueRevocations === 0 &&
  status.pending === 0 &&
  status.revocationsPastCritical === 0 &&
  status.revocationsPastWarning === 0;

const assertUpgradeConfiguration = (dependencies: TAuthzedUpgradeCliDependencies): void => {
  if (!dependencies.isEnabled()) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.DISABLED,
      operation: "upgrade_check_configuration",
      retryable: false,
    });
  }

  if (dependencies.consistency() !== "fully_consistent") {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
      operation: "upgrade_check_consistency",
      retryable: false,
    });
  }
};

const failed = (error: unknown): TAuthzedUpgradeResult => {
  const mapped = error instanceof AuthzedError ? error : mapAuthzedError(error, "upgrade_cli", 1);

  return { code: mapped.code, retryable: mapped.retryable, status: "failed" };
};

const runCheck = async (dependencies: TAuthzedUpgradeCliDependencies): Promise<TAuthzedUpgradeResult> => {
  const health = await dependencies.checkHealth();
  if (health.status !== "healthy") {
    return { health, status: "blocked" };
  }

  const schema = await dependencies.checkSchema();
  if (schema.status !== "matched") {
    return { datastoreMigrations: "ready", health, schema, status: "blocked" };
  }

  const outbox = await dependencies.outboxStatus();
  if (!isOutboxClean(outbox)) {
    return { datastoreMigrations: "ready", health, outbox, schema, status: "blocked" };
  }

  const audit = summarizeAudit(await dependencies.audit("dry_run", createAuthzedBackfillNoopApply()));
  return {
    audit,
    datastoreMigrations: "ready",
    health,
    outbox,
    schema,
    status: audit.status === "reconciled" ? "ready" : audit.status === "failed" ? "failed" : "blocked",
  };
};

const runPrepare = async (
  command: Extract<TAuthzedUpgradeCliCommand, { action: "prepare" }>,
  dependencies: TAuthzedUpgradeCliDependencies
): Promise<TAuthzedUpgradeResult> => {
  const health = await dependencies.checkHealth();
  if (health.status !== "healthy") {
    return { health, status: "blocked" };
  }

  const schema = await dependencies.applySchema(command.expectedCurrentDigest);
  const drain = await dependencies.drainOutbox();
  if (drain.status !== "drained" || drain.deadLettered > 0 || drain.failed > 0) {
    return { datastoreMigrations: "ready", health, outbox: drain, schema, status: "blocked" };
  }

  const reconciliation = await dependencies.audit("apply", createAuthzedBackfillApply());
  if (reconciliation.status === "failed") {
    return {
      audit: summarizeAudit(reconciliation),
      datastoreMigrations: "ready",
      health,
      outbox: drain,
      schema,
      status: "failed",
    };
  }

  const audit = summarizeAudit(await dependencies.audit("dry_run", createAuthzedBackfillNoopApply()));
  const outbox = await dependencies.outboxStatus();
  return {
    audit,
    datastoreMigrations: "ready",
    health,
    outbox,
    schema,
    status:
      audit.status === "failed"
        ? "failed"
        : audit.status === "reconciled" && isOutboxClean(outbox)
          ? "prepared"
          : "blocked",
  };
};

/**
 * Release-matched, fail-closed v6 upgrade gate.
 *
 * Output intentionally contains aggregate counters only. Detailed repair output remains available from
 * the explicit backfill command and is never folded into unattended upgrade logs.
 */
export const runAuthzedUpgradeCli = async (
  command: TAuthzedUpgradeCliCommand,
  dependencyOverrides: Partial<TAuthzedUpgradeCliDependencies> = {}
): Promise<number> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  let result: TAuthzedUpgradeResult;

  try {
    assertUpgradeConfiguration(dependencies);
    dependencies.configureBulkClient();
    result =
      command.action === "prepare" ? await runPrepare(command, dependencies) : await runCheck(dependencies);
  } catch (error) {
    result = failed(error);
  } finally {
    try {
      dependencies.closeClient();
    } catch {
      // Cleanup failures must not replace the sanitized upgrade result.
    }
  }

  dependencies.writeOutput(`${JSON.stringify(result)}\n`);
  return result.status === "ready" || result.status === "prepared" ? 0 : result.status === "blocked" ? 2 : 1;
};
