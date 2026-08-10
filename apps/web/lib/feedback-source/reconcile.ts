import "server-only";
import { logger } from "@formbricks/logger";
import { createFeedbackRecordsBatch, listFeedbackRecords, updateFeedbackRecord } from "@/modules/hub";
import type { FeedbackRecordCreateParams, FeedbackRecordUpdateParams } from "@/modules/hub/types";

/** Hub returns this when (tenant_id, submission_id, field_id) already exists. It is terminal. */
const CONFLICT_STATUS = 409;

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
   * Records Hub rejected for a reason other than "already exists".
   *
   * Returned rather than logged: the log levels on this path are an operator-visible contract
   * (ENG-1916) and belong to the caller, which knows the feedbackSourceId and reports one warn per
   * run with the per-record detail at debug. Logging here would reintroduce the per-record error
   * spam that made a single handled Hub outage look like an unhandled fault.
   */
  failures: TReconcileFailure[];
};

const emptyResult = (): TReconcileResult => ({ created: 0, reconciled: 0, failures: [] });

/**
 * The subset of a create payload Hub accepts on a PATCH.
 *
 * Mirrors Hub's UpdateFeedbackRecordRequest exactly. The omitted fields — source_*, field_*,
 * submission_id, collected_at — are not part of that request at all: they identify the record, so
 * changing one would mean addressing a different record rather than editing this one. Keep this in
 * step with the SDK's FeedbackRecordUpdateParams; a field missing here is silently never corrected.
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
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: TReconcileFailure["error"] }> => {
  const { data, error } = await listFeedbackRecords({
    tenant_id: tenantId,
    submission_id: record.submission_id,
    field_id: record.field_id,
    limit: 1,
  });

  if (error || !data) {
    return { ok: false, error: { status: error?.status, message: "reconcile lookup failed" } };
  }

  const existing = data.data[0];

  if (!existing) {
    // Hub said the row exists but a tenant-scoped lookup cannot see it. That is not a Hub outage —
    // it is the tenant boundary above disagreeing with Hub's uniqueness index, so it is logged here
    // (at error, exempt from the debug rule for handled Hub failures) rather than folded into the
    // caller's outage summary. Never guess at an id to patch: silently skipping is how the
    // stale-data bug this module exists to fix got in originally.
    logger.error(
      { tenantId, fieldId: record.field_id, submissionId: record.submission_id },
      "FeedbackSource reconcile: conflict reported but no record visible in this tenant"
    );

    return { ok: false, error: { message: "conflict not visible in tenant" } };
  }

  // Always PATCH rather than diffing here. Hub's own FieldsChangedFrom is comparison-based, so an
  // unchanged payload fires no event and costs no LLM enrichment — while re-implementing that
  // comparison in TS risks a subtle date/number mismatch that silently fails to correct stale data,
  // which is the exact defect being fixed.
  const updated = await updateFeedbackRecord(existing.id, toUpdateParams(record));

  if (updated.error) {
    return { ok: false, error: { status: updated.error.status, message: "reconcile update failed" } };
  }

  return { ok: true };
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
  tenantId: string
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

  const reconciled = await Promise.all(
    conflicts.map(async ({ record, index }) => ({
      index,
      outcome: await reconcileConflict(record, tenantId),
    }))
  );

  for (const { index, outcome } of reconciled) {
    if (outcome.ok) {
      result.reconciled += 1;
    } else {
      result.failures.push({ index, error: outcome.error });
    }
  }

  return result;
};
