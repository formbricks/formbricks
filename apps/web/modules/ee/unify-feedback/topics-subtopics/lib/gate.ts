import type { TaxonomyFieldOption } from "@/modules/hub/types";

/** Minimum open-text (value_text) records a dataset needs before the taxonomy UI is shown. */
export const MIN_OPEN_TEXT_RECORDS = 750;
/** Above this many records still awaiting embedding, hard-gate; at/below it, show inline progress. */
export const EMBEDDING_HARD_GATE_THRESHOLD = 50;
/** Poll cadence for the fields query while embeddings are still catching up. */
export const EMBEDDING_POLL_INTERVAL_MS = 3000;

export type TGateVariant = "insufficient" | "embedding" | null;

export type TGateResult = {
  totalOpenTextRecords: number;
  totalEmbeddedRecords: number;
  pendingEmbeddings: number;
  gateVariant: TGateVariant;
  showInlineProgress: boolean;
};

export function pendingEmbeddingsForFields(fields: TaxonomyFieldOption[]): number {
  return Math.max(
    0,
    fields.reduce((sum, field) => sum + (field.record_count - field.embedding_count), 0)
  );
}

/**
 * Decide the entry gate from the dataset's per-field counts. Records are partitioned by
 * (source, field), so summing per-field counts gives the dataset totals without double-counting.
 * Only evaluate once fields have loaded cleanly (not mid-load, error, or Hub-unavailable) — otherwise
 * a transient state could trip a false "not enough feedback" gate.
 */
export function computeGate(input: {
  fields: TaxonomyFieldOption[];
  hasDirectories: boolean;
  isLoading: boolean;
  isError: boolean;
  unavailable: boolean;
}): TGateResult {
  const totalOpenTextRecords = input.fields.reduce((sum, field) => sum + field.record_count, 0);
  const totalEmbeddedRecords = input.fields.reduce((sum, field) => sum + field.embedding_count, 0);
  const pendingEmbeddings = Math.max(0, totalOpenTextRecords - totalEmbeddedRecords);

  const canEvaluate = input.hasDirectories && !input.isLoading && !input.isError && !input.unavailable;

  let gateVariant: TGateVariant = null;
  if (canEvaluate) {
    if (totalOpenTextRecords < MIN_OPEN_TEXT_RECORDS) {
      gateVariant = "insufficient";
    } else if (pendingEmbeddings > EMBEDDING_HARD_GATE_THRESHOLD) {
      gateVariant = "embedding";
    }
  }

  const showInlineProgress = gateVariant === null && pendingEmbeddings > 0;

  return { totalOpenTextRecords, totalEmbeddedRecords, pendingEmbeddings, gateVariant, showInlineProgress };
}
