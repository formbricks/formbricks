import "server-only";
import { runAuthzedBackfill } from "@/lib/authzed/backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "@/lib/authzed/backfill-apply";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "@/lib/authzed/constants";
import { drainAuthzedOutbox } from "@/lib/authzed/outbox-processor";

/**
 * Converge the real integration database and the disposable SpiceDB fixture.
 *
 * Integration fixtures write through Prisma directly rather than product services. The database
 * triggers still enqueue durable projection events, but the Vitest harness intentionally does not
 * start the jobs worker. A full applying reconciliation also removes relationships left by the
 * previous test file: `resetDb()` truncates PostgreSQL and the outbox, while SpiceDB is shared by the
 * serial integration process.
 */
export const synchronizeAuthzedIntegrationFixture = async (): Promise<void> => {
  const client = getAuthzedClient();
  const request = {
    maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
    prune: true,
    scope: { kind: "all" },
  } as const;

  const applied = await runAuthzedBackfill(
    { ...request, mode: "apply" },
    { apply: createAuthzedBackfillApply(), client }
  );
  if (applied.counters.failed > 0) {
    throw new Error("AuthZed integration fixture reconciliation failed");
  }

  const drained = await drainAuthzedOutbox();
  if (drained.status !== "drained" || drained.failed > 0 || drained.deadLettered > 0) {
    throw new Error("AuthZed integration fixture outbox did not drain");
  }

  const verified = await runAuthzedBackfill(
    { ...request, mode: "dry_run" },
    { apply: createAuthzedBackfillNoopApply(), client }
  );
  if (verified.status !== "reconciled") {
    throw new Error("AuthZed integration fixture did not converge");
  }
};
