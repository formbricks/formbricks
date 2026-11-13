import "server-only";
import { prisma } from "@formbricks/database";
import { WORKFLOW_TRIGGERS } from "@formbricks/workflows";
import {
  WORKFLOW_RUN_RETENTION_BATCH_SIZE,
  WORKFLOW_RUN_RETENTION_MAX_BATCHES_PER_TICK,
  WORKFLOW_TEST_RUN_RETENTION_DAYS,
} from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The trigger payload keys a cleared run keeps: what the payload is and what it points at, never what it
 * carried. A Response completed payload keeps its ids and drops the response `data`; a Webhook payload
 * keeps its type and workspace and its `payload` becomes `{}`. The kept payload still parses as
 * `ZWorkflowTriggerRunPayload`, so the run resource keeps its shape.
 */
const KEPT_TRIGGER_PAYLOAD_KEYS = [
  "type",
  "workspaceId",
  "surveyId",
  "responseId",
  "endingCardId",
  "triggeredAt",
];

export interface WorkflowRunRetentionInput {
  now: Date;
  /** `WORKFLOW_RUN_DATA_RETENTION_DAYS`: content of runs finished longer ago is cleared, samples deleted. */
  retentionDays: number;
  batchSize?: number;
  maxBatches?: number;
}

export interface WorkflowRunRetentionResult {
  runContentCleared: number;
  testRunsDeleted: number;
  samplesDeleted: number;
}

/** One batch: how many rows it looked at (a short batch means nothing is left) and how many it changed. */
interface BatchResult {
  scanned: number;
  changed: number;
}

/** Runs batches until one comes back short or the tick's budget is spent; the next tick goes on. */
const drain = async (
  runBatch: () => Promise<BatchResult>,
  batchSize: number,
  maxBatches: number
): Promise<number> => {
  let changed = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await runBatch();
    changed += result.changed;
    if (result.scanned < batchSize) break;
  }
  return changed;
};

/**
 * Clears the content of one batch of runs that finished before `cutoff` (ADR 0044): the trigger payload's
 * contents, the run data, the run error and the caller IP, and in the same transaction every step's input,
 * output and error. Status, trigger type, workflow, version and every timestamp stay, so usage counts over
 * any past range are unchanged. `updated_at` is left alone too: clearing is not an edit of the run.
 *
 * Idempotent: a cleared run has `contentDeletedAt` set and is never picked again. `SKIP LOCKED` lets two
 * overlapping ticks take different runs instead of waiting on each other, and the batch is found through
 * `@@index([contentDeletedAt, finishedAt])`. Runs still queued or running have no `finishedAt` and are
 * never touched.
 */
const clearRunContentBatch = async (
  now: Date,
  retentionDays: number,
  batchSize: number
): Promise<BatchResult> => {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);

  return prisma.$transaction(async (tx) => {
    const cleared = await tx.$queryRaw<{ id: string }[]>`
      WITH due AS (
        SELECT "id" FROM "WorkflowRun"
        WHERE "contentDeletedAt" IS NULL AND "finishedAt" < ${cutoff}
        ORDER BY "finishedAt"
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "WorkflowRun" AS r
      SET "triggerPayload" =
            COALESCE(
              (SELECT jsonb_object_agg(e.key, e.value)
                 FROM jsonb_each(r."triggerPayload") AS e
                WHERE e.key = ANY(${KEPT_TRIGGER_PAYLOAD_KEYS}::text[])),
              '{}'::jsonb
            )
            || CASE WHEN r."triggerPayload"->>'type' = ${WORKFLOW_TRIGGERS.WEBHOOK}
                    THEN '{"payload": {}}'::jsonb ELSE '{}'::jsonb END,
          "data" = '{}'::jsonb,
          "error" = NULL,
          "callerIp" = NULL,
          "contentDeletedAt" = ${now},
          "contentRetentionDays" = ${retentionDays}
      FROM due
      WHERE r."id" = due."id"
      RETURNING r."id"
    `;

    if (cleared.length > 0) {
      await tx.workflowRunLog.updateMany({
        where: { runId: { in: cleared.map((run) => run.id) } },
        data: { input: {}, output: {}, error: null },
      });
    }

    return { scanned: cleared.length, changed: cleared.length };
  });
};

/**
 * Deletes one batch of Test runs (ENG-7181) started more than `WORKFLOW_TEST_RUN_RETENTION_DAYS` ago,
 * with their step logs (cascade). Test runs never count as usage, so deleting them whole changes no count.
 */
const deleteTestRunBatch = async (now: Date, batchSize: number): Promise<BatchResult> => {
  const cutoff = new Date(now.getTime() - WORKFLOW_TEST_RUN_RETENTION_DAYS * DAY_MS);
  const due = await prisma.workflowRun.findMany({
    where: { isDryRun: true, createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });
  if (due.length === 0) return { scanned: 0, changed: 0 };

  const { count } = await prisma.workflowRun.deleteMany({
    where: { id: { in: due.map((run) => run.id) }, isDryRun: true },
  });
  return { scanned: due.length, changed: count };
};

/**
 * Deletes one batch of saved samples (ADR 0048) not updated for the retention period. The delete repeats
 * the age check, so a sample a call refreshed between the scan and the delete is kept.
 */
const deleteStaleSampleBatch = async (
  now: Date,
  retentionDays: number,
  batchSize: number
): Promise<BatchResult> => {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  const due = await prisma.workflowSample.findMany({
    where: { updatedAt: { lt: cutoff } },
    orderBy: { updatedAt: "asc" },
    take: batchSize,
    select: { id: true },
  });
  if (due.length === 0) return { scanned: 0, changed: 0 };

  const { count } = await prisma.workflowSample.deleteMany({
    where: { id: { in: due.map((sample) => sample.id) }, updatedAt: { lt: cutoff } },
  });
  return { scanned: due.length, changed: count };
};

/**
 * Workflow run data retention (ENG-7186, ADR 0044), for every workflow whatever its trigger: clears the
 * content of runs finished more than `retentionDays` ago, deletes Test runs older than 7 days and deletes
 * samples not updated for `retentionDays`. Each kind works in batches of `batchSize` rows, one short
 * statement or transaction each, and stops after `maxBatches` per tick; what is left waits for the next
 * tick. Safe to rerun at any time.
 */
export const runWorkflowRunRetention = async ({
  now,
  retentionDays,
  batchSize = WORKFLOW_RUN_RETENTION_BATCH_SIZE,
  maxBatches = WORKFLOW_RUN_RETENTION_MAX_BATCHES_PER_TICK,
}: WorkflowRunRetentionInput): Promise<WorkflowRunRetentionResult> => {
  const runContentCleared = await drain(
    () => clearRunContentBatch(now, retentionDays, batchSize),
    batchSize,
    maxBatches
  );
  const testRunsDeleted = await drain(() => deleteTestRunBatch(now, batchSize), batchSize, maxBatches);
  const samplesDeleted = await drain(
    () => deleteStaleSampleBatch(now, retentionDays, batchSize),
    batchSize,
    maxBatches
  );

  return { runContentCleared, testRunsDeleted, samplesDeleted };
};
