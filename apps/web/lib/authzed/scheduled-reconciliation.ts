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
