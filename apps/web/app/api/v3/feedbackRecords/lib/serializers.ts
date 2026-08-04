import type {
  FeedbackRecordData,
  SemanticSearchResultItem,
  SimilarRecordsResultItem,
} from "@/modules/hub/types";

/** The two similarity endpoints return the same row shape; either is acceptable here. */
type FeedbackRecordMatchSource = SemanticSearchResultItem | SimilarRecordsResultItem;

/**
 * Public DTO for a feedback record. Field names mirror the Hub's feedback-record contract (snake_case)
 * so the MCP surface, the Unify UI, and the Hub API documentation all describe the same shape.
 *
 * One deliberate exception: the Hub's `tenant_id` is emitted as **`dataset_id`**. The value is the same
 * (a `FeedbackDirectory.id`), but "tenant" is Hub-internal vocabulary — the product, its UI and its docs
 * call this a Feedback Dataset, so that is what the outward-facing surface says. Internal code keeps the
 * `feedbackDirectory*` names; this serializer is the one place the outbound mapping happens.
 *
 * This is an explicit allowlist (not a pass-through of the SDK object): only the documented Hub fields
 * are ever emitted, so a future SDK/bridge addition can't silently widen the response (OWASP API3).
 * Read-only enrichment fields (sentiment/emotions/translation) are included when present.
 */
export type TV3FeedbackRecord = {
  id: string;
  dataset_id?: string;
  submission_id?: string;
  source_type?: string;
  source_id?: string;
  source_name?: string;
  field_id?: string;
  field_type?: string;
  field_label?: string;
  field_group_id?: string;
  field_group_label?: string;
  user_id?: string;
  language?: string;
  value_text?: string | null;
  value_number?: number;
  value_boolean?: boolean;
  value_date?: string;
  value_id?: string | null;
  metadata?: Record<string, unknown>;
  sentiment?: string;
  sentiment_score?: number;
  emotions?: string[] | string | null;
  translation_lang_key?: string | null;
  value_text_translated?: string | null;
  collected_at?: string;
  created_at?: string;
  updated_at?: string;
};

// Allowlisted optional fields copied verbatim from the Hub record when present (explicit nulls
// preserved). `tenant_id` is absent on purpose — it is renamed to `dataset_id` below.
const FEEDBACK_RECORD_FIELDS = [
  "submission_id",
  "source_type",
  "source_id",
  "source_name",
  "field_id",
  "field_type",
  "field_label",
  "field_group_id",
  "field_group_label",
  "user_id",
  "language",
  "value_text",
  "value_number",
  "value_boolean",
  "value_date",
  "value_id",
  "metadata",
  "sentiment",
  "sentiment_score",
  "emotions",
  "translation_lang_key",
  "value_text_translated",
  "collected_at",
  "created_at",
  "updated_at",
] as const;

export const serializeV3FeedbackRecord = (record: FeedbackRecordData): TV3FeedbackRecord => {
  const source = record as unknown as Record<string, unknown>;
  const dto: TV3FeedbackRecord = { id: record.id };
  const writable = dto as Record<string, unknown>;

  // The Hub's tenant is our dataset — same value, outward-facing name.
  if (record.tenant_id !== undefined) {
    dto.dataset_id = record.tenant_id;
  }

  for (const key of FEEDBACK_RECORD_FIELDS) {
    if (source[key] !== undefined) {
      writable[key] = source[key];
    }
  }
  return dto;
};

/**
 * One scored match from a similarity search. The Hub returns an identical row shape for text search and
 * for "records like this one", so both go through this serializer.
 *
 * Only the fields needed to triage a hit are emitted — the id (to fetch the full record), the score, and
 * the embedded text with its field label. Hydrating each hit into a full record would cost one Hub call
 * per result; the caller can do that selectively via the get operation.
 */
export type TV3FeedbackRecordMatch = {
  feedback_record_id: string;
  /** Cosine similarity, 0 (unrelated) to 1 (identical). Results are ordered best first. */
  score: number;
  field_label: string;
  value_text: string;
};

export const serializeV3FeedbackRecordMatch = (match: FeedbackRecordMatchSource): TV3FeedbackRecordMatch => ({
  feedback_record_id: match.feedback_record_id,
  score: match.score,
  field_label: match.field_label,
  value_text: match.value_text,
});

export type TV3FeedbackDataset = {
  id: string;
  name: string;
};

export const serializeV3FeedbackDataset = (dataset: { id: string; name: string }): TV3FeedbackDataset => ({
  id: dataset.id,
  name: dataset.name,
});
