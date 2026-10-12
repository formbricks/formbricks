import "server-only";
import { logger } from "@formbricks/logger";
import { runAuthzedBackfill } from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import { getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { recordAuthzedReconciliationAudit, recordAuthzedReconciliationRepair } from "./metrics";
import { pruneAuthzedOutboxHistory, replayAuthzedOutboxDeadLetters } from "./outbox-repository";

/** Six-hour full audit. It repairs attributable missing/mismatched edges and never prunes unknown data. */
export const processAuthzedScheduledReconciliationJob = async (): Promise<void> => {
  if (!isAuthzedEnabled()) return;
  const client = getAuthzedClient();
  const request = {
    maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
    prune: false,
    scope: { kind: "all" },
  } as const;
  const observed = await runAuthzedBackfill(
    { ...request, mode: "dry_run" },
    { apply: createAuthzedBackfillNoopApply(), client }
  );
  let result = observed;

  if (observed.status === "drifted") {
    const applied = await runAuthzedBackfill(
      { ...request, mode: "apply" },
      { apply: createAuthzedBackfillApply(), client }
    );
    recordAuthzedReconciliationRepair({
      failed: applied.counters.failed,
      repaired: applied.counters.reconciled,
    });
    result = await runAuthzedBackfill(
      { ...request, mode: "dry_run" },
      { apply: createAuthzedBackfillNoopApply(), client }
    );
  }

  recordAuthzedReconciliationAudit({
    drift: observed.counters.missing + observed.counters.mismatchedPermissions,
    failures: result.counters.failed,
    status: result.status,
  });

  if (result.status !== "reconciled") {
    logger.warn(
      {
        component: "authzed",
        drift: result.counters.missing + result.counters.mismatchedPermissions,
        failures: result.counters.failed,
        operation: "scheduled_reconciliation",
        status: result.status,
      },
      "Scheduled AuthZed relationship reconciliation did not finish cleanly"
    );
  }

  // Runs whatever the audit concluded: it only deletes rows delivered more than a week ago, so it is
  // never the thing standing between an operator and evidence.
  await pruneAuthzedOutboxHistory();

  // A clean full audit means PostgreSQL and SpiceDB already agree everywhere, so whatever a dead
  // letter was trying to say has since been said by other means. Hand it back to the delivery loop
  // rather than leaving the freshness guard denying every authorization check until someone runs
  // `outbox replay` by hand — a dead-lettered revocation has no age bound in that guard on purpose.
  // A still-poisoned event simply re-dead-letters, so this is a six-hourly retry, not a loop. The
  // audit sweeps organizations, so an event for a deleted user or a cross-tenant pair may not be
  // covered by `reconciled`; replaying it anyway is idempotent and strictly better than denying.
  if (result.status === "reconciled") await replayAuthzedOutboxDeadLetters();
};

/**
 * Daily survey projection audit (ENG-3282). Dry run only — metrics and a warning, never a write: the
 * outbox converges surveys continuously, and a repair is an operator's `--scope=survey --apply`. It
 * leaves dead letters alone; a survey event is not a revocation-guard input worth replaying blind.
 */
export const processAuthzedSurveyAuditJob = async (): Promise<void> => {
  if (!isAuthzedEnabled()) return;
  const result = await runAuthzedBackfill(
    {
      maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
      mode: "dry_run",
      prune: false,
      scope: { kind: "survey" },
    },
    { apply: createAuthzedBackfillNoopApply(), client: getAuthzedClient() }
  );
  const drift =
    result.counters.missing +
    result.counters.mismatchedPermissions +
    result.counters.mismatchedParents +
    result.counters.orphaned;

  recordAuthzedReconciliationAudit({
    drift,
    failures: result.counters.failed,
    scope: "survey",
    status: result.status,
  });

  if (result.status !== "reconciled") {
    logger.warn(
      {
        component: "authzed",
        drift,
        failures: result.counters.failed,
        operation: "scheduled_survey_audit",
        status: result.status,
      },
      "Scheduled AuthZed survey audit found drift"
    );
  }
};
