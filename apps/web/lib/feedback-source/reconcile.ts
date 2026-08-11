import "server-only";
import { logger } from "@formbricks/logger";
import { createFeedbackRecordsBatch, listFeedbackRecords, updateFeedbackRecord } from "@/modules/hub";
import type { FeedbackRecordCreateParams, FeedbackRecordUpdateParams } from "@/modules/hub/types";

/** Hub returns this when (tenant_id, submission_id, field_id) already exists. It is terminal. */
const CONFLICT_STATUS = 409;

/**
 * How many conflicts reconcile at once.
 *
 * Each one costs a lookup plus a PATCH, and a re-import is the case where *every* record conflicts —
 * so an unbounded fan-out would put IMPORT_BATCH_SIZE x mappings round trips in flight at once and
 * invite rate-limiting. Note the create itself (`createFeedbackRecordsBatch`) is still an unbounded
 * Promise.all upstream of this; capping it is the same fix but a wider blast radius, so it is left
 * to its own change.
 */
const RECONCILE_CONCURRENCY = 8;

/**
 * A post-409 lookup that comes back empty is retried once after this delay.
 *
 * Hub told us the row exists, so an empty tenant-scoped read is usually read-after-write lag rather
 * than the tenant boundary being wrong. One short retry separates the two without turning a real
 * anomaly into a slow loop.
 */
const NOT_VISIBLE_RETRY_DELAY_MS = 150;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** One record Hub rejected for a reason other than "already exists", with its index in the input. */
export type TReconcileFailure = {
  index: number;
  error: { status?: number; message?: string; detail?: string };
};

export type TReconcileResult = {
  /** Records that did not exist yet. */
  created: number;
  /** Records that already existed and were re-sent so Hub could apply any change. */
  reconciled: number;
  /**
   * Records left untouched because Hub already holds a write newer than the data being reconciled.
   *
   * Not a failure: the record is correct, a fresher writer just got there first. See `snapshotAt`.
   */
  superseded: number;
  /**
   * Records Hub rejected for a reason other than "already exists".
   *
   * Returned rather than logged: the log levels on this path are an operator-visible contract
   * (ENG-1916) and belong to the caller, which knows the feedbackSourceId and reports one warn per
   * run with the per-record detail at debug. Logging here would reintroduce the per-record error
   * spam that made a single handled Hub outage look like an unhandled fault.
   */
  failures: TReconcileFailure[];
};

export type TReconcileOptions = {
  /**
   * When the records being reconciled were read from Postgres.
   *
   * Two uncoordinated writers reach this module: the live pipeline (on finish, always current) and
   * the historical import (which can hold a page of responses for a long time). If Hub's copy was
   * updated *after* this snapshot was taken, the other writer has fresher data and this PATCH would
   * revert it — the exact stale-value defect ENG-2058 exists to fix, just from the other direction.
   * Pass it from any caller whose data can age; omit it to always write.
   *
   * Compares our clock against Hub's `updated_at`, so it assumes roughly synced clocks. The window
   * it guards is a long import, not milliseconds, so ordinary NTP skew does not matter.
   */
  snapshotAt?: Date;
};

const emptyResult = (): TReconcileResult => ({
  created: 0,
  reconciled: 0,
  superseded: 0,
  failures: [],
});

/**
 * Every field Hub's UpdateFeedbackRecordRequest accepts.
 *
 * `satisfies Record<keyof Required<...>, true>` is the point: each field on
 * FeedbackRecordUpdateParams is optional, so a plain object literal would happily omit a new one and
 * still compile — the record would just silently never be corrected on that field. This makes an SDK
 * bump that adds an update-eligible field a build error instead. `toUpdateParams` is checked against
 * this list at runtime by its test.
 */
export const UPDATE_FIELD_KEYS = {
  language: true,
  metadata: true,
  user_id: true,
  value_boolean: true,
  value_date: true,
  value_id: true,
  value_number: true,
  value_text: true,
} as const satisfies Record<keyof Required<FeedbackRecordUpdateParams>, true>;

/**
 * The subset of a create payload Hub accepts on a PATCH.
 *
 * Mirrors Hub's UpdateFeedbackRecordRequest exactly — see UPDATE_FIELD_KEYS. The omitted fields —
 * source_*, field_*, submission_id, collected_at — are not part of that request at all: they
 * identify the record, so changing one would mean addressing a different record rather than editing
 * this one.
 */
const toUpdateParams = (record: FeedbackRecordCreateParams): FeedbackRecordUpdateParams => ({
  // The SDK types value_text as nullable on create but not on update. Coerce null to undefined,
  // which Hub reads as "leave unchanged" — transform.ts never emits a record without a value, so a
  // null here would mean "no answer to send" rather than "clear the stored answer".
  value_text: record.value_text ?? undefined,
  value_number: record.value_number,
  value_boolean: record.value_boolean,
  value_date: record.value_date,
  // Carries the selected choice's id for single/multi select. Omitting it left a reconciled record
  // pointing at the *old* choice while its text showed the new one, and value_id is what the charts
  // group by — so the correction landed everywhere except the place it is read.
  value_id: record.value_id,
  metadata: record.metadata,
  language: record.language,
  user_id: record.user_id,
});

/** True when Hub's copy was written after we read ours, so ours is the stale one. */
const isSupersededBy = (updatedAt: string | undefined, snapshotAt: Date | undefined): boolean => {
  if (!snapshotAt || !updatedAt) return false;

  const hubWroteAt = Date.parse(updatedAt);

  return Number.isFinite(hubWroteAt) && hubWroteAt > snapshotAt.getTime();
};

type TConflictOutcome =
  | { status: "reconciled" }
  | { status: "superseded" }
  | { status: "not_visible" }
  | { status: "failed"; error: TReconcileFailure["error"] };

/**
 * Bring one already-existing record in line with what we just tried to create.
 *
 * SECURITY (ENG-2058 S1): the lookup is the tenant boundary. Hub resolves the tenant *from the
 * record id* on PATCH (`resolveFeedbackRecordTenant`) and performs no caller-side check, so any id
 * handed to it gets written. The id used here must therefore come from a lookup scoped to this
 * source's own tenant — never from an error body, a cache, or caller input. `submission_id` is a
 * globally unique cuid, but uniqueness is not an access control; the tenant_id filter is.
 */
const reconcileConflict = async (
  record: FeedbackRecordCreateParams,
  tenantId: string,
  snapshotAt: Date | undefined
): Promise<TConflictOutcome> => {
  const lookup = async () =>
    listFeedbackRecords({
      tenant_id: tenantId,
      submission_id: record.submission_id,
      field_id: record.field_id,
      limit: 1,
    });

  let { data, error } = await lookup();

  if (error || !data) {
    return { status: "failed", error: { status: error?.status, message: "reconcile lookup failed" } };
  }

  if (!data.data[0]) {
    // Hub said the row exists, so an empty read here is far more likely to be replication lag than a
    // boundary violation. Retry once before treating it as an anomaly.
    await sleep(NOT_VISIBLE_RETRY_DELAY_MS);
    ({ data, error } = await lookup());

    if (error || !data) {
      return { status: "failed", error: { status: error?.status, message: "reconcile lookup failed" } };
    }
  }

  const existing = data.data[0];

  if (!existing) {
    // Still nothing after a retry: Hub's uniqueness index and this tenant's view disagree. Never
    // guess at an id to patch — silently skipping is how the stale-data bug this module exists to
    // fix got in originally. The caller logs these once per run rather than once per record.
    return { status: "not_visible" };
  }

  if (isSupersededBy(existing.updated_at, snapshotAt)) {
    return { status: "superseded" };
  }

  // Always PATCH rather than diffing here. Hub's own FieldsChangedFrom is comparison-based, so an
  // unchanged payload fires no event and costs no LLM enrichment — while re-implementing that
  // comparison in TS risks a subtle date/number mismatch that silently fails to correct stale data,
  // which is the exact defect being fixed.
  const updated = await updateFeedbackRecord(existing.id, toUpdateParams(record));

  if (updated.error) {
    return { status: "failed", error: { status: updated.error.status, message: "reconcile update failed" } };
  }

  return { status: "reconciled" };
};

/** Run `fn` over `items` with at most `limit` in flight, preserving input order in the output. */
const mapWithConcurrency = async <TIn, TOut>(
  items: TIn[],
  limit: number,
  fn: (item: TIn) => Promise<TOut>
): Promise<TOut[]> => {
  const results = new Array<TOut>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
};

/**
 * Send feedback records to Hub, correcting any that already exist.
 *
 * Optimistic on purpose: create everything first, then reconcile only what came back 409. With no
 * conflicts — a fresh source, or a finish with no prior partial — this costs exactly what a plain
 * batch create costs. Only genuine overlap pays for the extra lookup and update.
 *
 * A 409 is not a failure. It is the normal shape of re-importing a response that was already
 * ingested as a partial, and treating it as an error is what produced both the stale values in Hub
 * and the wall of false "Failed to create FeedbackRecord" logs.
 *
 * Never logs record contents: respondent free text is PII.
 */
export const reconcileFeedbackRecords = async (
  records: FeedbackRecordCreateParams[],
  tenantId: string,
  { snapshotAt }: TReconcileOptions = {}
): Promise<TReconcileResult> => {
  if (records.length === 0) {
    return emptyResult();
  }

  const { results } = await createFeedbackRecordsBatch(records);
  const result = emptyResult();
  const conflicts: { record: FeedbackRecordCreateParams; index: number }[] = [];

  for (const [index, outcome] of results.entries()) {
    if (!outcome.error) {
      result.created += 1;
      continue;
    }

    if (outcome.error.status === CONFLICT_STATUS) {
      const record = records[index];
      if (record) {
        conflicts.push({ record, index });
      }

      continue;
    }

    result.failures.push({
      index,
      error: {
        status: outcome.error.status,
        message: outcome.error.message,
        detail: outcome.error.detail,
      },
    });
  }

  const reconciled = await mapWithConcurrency(
    conflicts,
    RECONCILE_CONCURRENCY,
    async ({ record, index }) => ({
      index,
      fieldId: record.field_id,
      outcome: await reconcileConflict(record, tenantId, snapshotAt),
    })
  );

  const notVisible: { index: number; fieldId: string }[] = [];

  for (const { index, fieldId, outcome } of reconciled) {
    if (outcome.status === "reconciled") {
      result.reconciled += 1;
    } else if (outcome.status === "superseded") {
      result.superseded += 1;
    } else if (outcome.status === "not_visible") {
      notVisible.push({ index, fieldId });
      result.failures.push({ index, error: { message: "conflict not visible in tenant" } });
    } else {
      result.failures.push({ index, error: outcome.error });
    }
  }

  if (notVisible.length > 0) {
    // One line per run, not per record — the per-record spam is what ENG-1916 removed. Still at
    // error rather than the caller's outage summary: this is the tenant boundary disagreeing with
    // Hub's uniqueness index after a retry, which is an invariant breach, not a handled outage.
    logger.error(
      { tenantId, count: notVisible.length, fieldIds: notVisible.map(({ fieldId }) => fieldId) },
      "FeedbackSource reconcile: conflicts reported but no record visible in this tenant"
    );
  }

  return result;
};
