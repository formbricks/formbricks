import "server-only";
import { logger } from "@formbricks/logger";
import { runAuthzedBackfill } from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import { getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { recordAuthzedReconciliationAudit } from "./metrics";
import { pruneAuthzedOutboxHistory } from "./outbox-repository";

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
    await runAuthzedBackfill({ ...request, mode: "apply" }, { apply: createAuthzedBackfillApply(), client });
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

  await pruneAuthzedOutboxHistory();
};
