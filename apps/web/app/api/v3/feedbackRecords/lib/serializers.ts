import type { FeedbackRecordData } from "@/modules/hub/types";

/**
 * Public DTO for a feedback record. Field names mirror the Hub's feedback-record contract (snake_case)
 * so the MCP surface, the Unify UI, and the Hub API documentation all describe the same shape.
 *
 * This is an explicit allowlist (not a pass-through of the SDK object): only the documented Hub fields
 * are ever emitted, so a future SDK/bridge addition can't silently widen the response (OWASP API3).
 * Read-only enrichment fields (sentiment/emotions/translation) are included when present.
 */
export type TV3FeedbackRecord = {
  id: string;
  tenant_id?: string;
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

// Allowlisted optional fields copied from the Hub record when present (explicit nulls preserved).
const FEEDBACK_RECORD_FIELDS = [
  "tenant_id",
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
  for (const key of FEEDBACK_RECORD_FIELDS) {
    if (source[key] !== undefined) {
      writable[key] = source[key];
    }
  }
  return dto;
};

export type TV3FeedbackDirectory = {
  id: string;
  name: string;
};

export const serializeV3FeedbackDirectory = (directory: {
  id: string;
  name: string;
}): TV3FeedbackDirectory => ({
  id: directory.id,
  name: directory.name,
});
