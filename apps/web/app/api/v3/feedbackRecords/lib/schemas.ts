import { z } from "zod";
import { ZHubFieldType } from "@formbricks/types/feedback-source";

/**
 * v3-owned schemas for the feedback-records surface. Kept in the v3 layer (not the MCP layer) so the
 * operations can validate independently of any transport, mirroring the surveys operations.
 *
 * `tenant_id` is deliberately absent from every schema here — it is always resolved server-side from
 * the caller's workspace + feedback directory and never accepted from input (tenant isolation).
 */

/**
 * The filter set shared by listing and counting feedback records — the Hub documents its `/count` endpoint
 * as taking "the same query parameters as the list endpoint", minus pagination, so both are described once
 * here and mapped to Hub params by one function in `operations.ts`.
 *
 * Field semantics follow the Hub's own `GET /v1/feedback-records` parameter documentation (hub 0.8.1
 * `openapi.yaml`). Every filter is a plain equality match, combined with AND, and always scoped to the
 * resolved dataset. Length caps mirror the Hub's (1–255); it additionally rejects NULL bytes and relays
 * that as a 400 we pass through.
 */
const ZFeedbackRecordFilterId = z.string().trim().min(1).max(255);

export const ZV3FeedbackRecordFilters = z.object({
  sourceType: ZFeedbackRecordFilterId.optional().describe(
    "Filter by feedback source type, e.g. survey, review, call_notes."
  ),
  sourceId: ZFeedbackRecordFilterId.optional().describe(
    "Filter by source id — the survey/form/ticket the feedback came from."
  ),
  fieldType: ZHubFieldType.optional().describe("Filter by field type."),
  fieldId: ZFeedbackRecordFilterId.optional().describe("Filter by field id — all answers to one question."),
  fieldGroupId: ZFeedbackRecordFilterId.optional().describe(
    "Filter by field group id, which groups related fields of one question (ranking, matrix, grid)."
  ),
  submissionId: ZFeedbackRecordFilterId.optional().describe(
    "Filter by submission id — the sibling records of one logical submission, i.e. the rest of the answers given at the same time."
  ),
  userId: ZFeedbackRecordFilterId.optional().describe(
    "Filter by end-user identifier — everything one person submitted."
  ),
  valueId: ZFeedbackRecordFilterId.optional().describe(
    "Filter by the source system's stable option id, e.g. everyone who picked one particular survey choice."
  ),
  since: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only records collected at or after this ISO 8601 timestamp (bounds collected_at). Must fall between 1970-01-01 and 2080-12-31."
    ),
  until: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only records collected at or before this ISO 8601 timestamp (bounds collected_at). Must fall between 1970-01-01 and 2080-12-31."
    ),
});
export type TV3FeedbackRecordFilters = z.infer<typeof ZV3FeedbackRecordFilters>;

// Listing adds keyset pagination on top of the shared filters (the Hub's cursor/keyset contract).
export const ZV3FeedbackRecordListFilters = ZV3FeedbackRecordFilters.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Maximum number of records to return (1–1000). Defaults to 50."),
  cursor: z
    .string()
    .min(1)
    .optional()
    .describe("Opaque keyset cursor from a previous response's nextCursor. Omit for the first page."),
});
export type TV3FeedbackRecordListFilters = z.infer<typeof ZV3FeedbackRecordListFilters>;

/**
 * Shared parameters for the two similarity searches (by text, and by example record). Both hit the Hub's
 * vector index and return the same scored-row shape.
 *
 * The bounds are enforced here rather than left to the Hub, which silently coerces out-of-range values to
 * its defaults instead of rejecting them — so `limit: 999` or `minScore: 5` would quietly return
 * something other than what was asked for. Locally they become an actionable `invalid_params` error.
 */
export const SIMILARITY_LIMIT_DEFAULT = 10;
export const SIMILARITY_LIMIT_MAX = 100;

/**
 * Our default, deliberately below the Hub's own 0.7: at 0.7 a paraphrase of a record often scores just
 * under and the caller sees an empty result, which reads as "nothing matched" rather than "the threshold
 * was strict". 0.5 matches what the Unify topic UI already treats as a meaningful match.
 */
export const SIMILARITY_MIN_SCORE_DEFAULT = 0.5;

// Every search embeds its query with the configured provider, so the query is a cost and a rate-limit
// input, not just a string. Well above any real question, well below a pasted document.
const MAX_SEARCH_QUERY_LENGTH = 2000;

export const ZV3FeedbackRecordSimilarityFilters = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(SIMILARITY_LIMIT_MAX)
    .optional()
    .describe(
      `Maximum number of matches to return (1–${SIMILARITY_LIMIT_MAX}). Defaults to ${SIMILARITY_LIMIT_DEFAULT}.`
    ),
  cursor: z
    .string()
    .min(1)
    .optional()
    .describe("Opaque keyset cursor from a previous response's nextCursor. Omit for the first page."),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      `Minimum similarity score to include, from 0 (unrelated) to 1 (identical). Defaults to ${SIMILARITY_MIN_SCORE_DEFAULT}. Raise it for stricter matches; lower it when a search returns nothing.`
    ),
});
export type TV3FeedbackRecordSimilarityFilters = z.infer<typeof ZV3FeedbackRecordSimilarityFilters>;

export const ZV3FeedbackRecordSearchFilters = ZV3FeedbackRecordSimilarityFilters.extend({
  query: z
    .string()
    .trim()
    .min(1)
    .max(MAX_SEARCH_QUERY_LENGTH)
    .describe("Natural-language text to match feedback records against by meaning, not by keyword."),
});
export type TV3FeedbackRecordSearchFilters = z.infer<typeof ZV3FeedbackRecordSearchFilters>;

/**
 * Create body — mirrors the Hub `CreateFeedbackRecordInputBody`, WITHOUT `tenant_id`. Length/type
 * bounds match the Hub contract so oversized/invalid input is rejected early; the Hub remains the
 * source of truth for the remaining content rules (no NULL bytes, its own length limits), and its
 * field-level failures are relayed to the caller by `hubErrorToProblemResponse`.
 *
 * The Hub does NOT check that the populated `value_*` matches `field_type` (it accepts `field_type:
 * "text"` carrying only `value_number`, and even a record with no value at all), so we enforce it here.
 * Without this a mistyped field name — MCP strips unknown keys before we ever see them, so `valueText`
 * simply vanishes — would store a permanently empty record and report success.
 */
const VALUE_FIELD_BY_TYPE: Record<z.infer<typeof ZHubFieldType>, string[]> = {
  text: ["value_text"],
  // A choice can be identified by its label, its stable option id, or both.
  categorical: ["value_text", "value_id"],
  nps: ["value_number"],
  csat: ["value_number"],
  ces: ["value_number"],
  rating: ["value_number"],
  number: ["value_number"],
  boolean: ["value_boolean"],
  date: ["value_date"],
};

// Keep well under the Hub's 512 KiB request cap so an oversized payload fails here, with a clear
// message, instead of arriving as an opaque upstream rejection.
const MAX_METADATA_BYTES = 32_768;

export const ZV3FeedbackRecordCreateBodyFields = z.object({
  source_type: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe("Type of feedback source, e.g. survey, review, call_notes."),
  field_id: z.string().trim().min(1).max(255).describe("Identifier for the question/field."),
  field_type: ZHubFieldType.describe("Field type; determines which value_* field applies."),
  submission_id: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe(
      "Logical submission this record belongs to (groups multi-field submissions). A UUID is generated when omitted."
    ),
  value_text: z.string().max(30000).optional().describe("Open-ended text response."),
  value_number: z.number().optional().describe("Numeric response (ratings, NPS, numbers)."),
  value_boolean: z.boolean().optional().describe("Boolean (yes/no) response."),
  value_date: z.string().trim().min(1).optional().describe("Date response as an ISO 8601 timestamp."),
  value_id: z
    .string()
    .max(255)
    .optional()
    .describe("Stable id of the selected option in the source system (e.g. a survey choice id)."),
  user_id: z.string().max(255).optional().describe("End-user identifier (e.g. anonymous id or email hash)."),
  language: z.string().max(10).optional().describe("ISO language code of the response."),
  source_id: z.string().max(255).optional().describe("Reference to the survey/form/ticket id."),
  source_name: z.string().max(255).optional().describe("Human-readable source name."),
  field_group_id: z
    .string()
    .max(255)
    .optional()
    .describe("Stable id grouping related fields (ranking, matrix, grid)."),
  field_group_label: z.string().max(2048).optional().describe("Human-readable group question text."),
  field_label: z.string().max(2048).optional().describe("The actual question text."),
  collected_at: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("When the feedback was collected, as an ISO 8601 timestamp. Defaults to now."),
  metadata: z
    .record(z.string(), z.unknown())
    // Byte length, not string length: JSON.stringify(...).length counts UTF-16 code units, so a CJK or
    // emoji payload would slip through at several times the advertised size.
    .refine((value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_METADATA_BYTES, {
      message: `must serialize to at most ${MAX_METADATA_BYTES} bytes`,
    })
    .optional()
    .describe("Additional context (device, tags, etc.)."),
});

export const ZV3FeedbackRecordCreateBody = ZV3FeedbackRecordCreateBodyFields.superRefine((data, ctx) => {
  const accepted = VALUE_FIELD_BY_TYPE[data.field_type];
  if (accepted.some((field) => data[field as keyof typeof data] !== undefined)) {
    return;
  }

  ctx.addIssue({
    code: "custom",
    // Report against the field the caller should have sent, so the error points at the fix.
    path: [accepted[0]],
    message: `is required for field_type "${data.field_type}" (expected one of: ${accepted.join(", ")})`,
  });
});

export type TV3FeedbackRecordCreateBody = z.infer<typeof ZV3FeedbackRecordCreateBody>;

/**
 * Update body — the **mutable subset** of the create fields, picked from them rather than redeclared so the
 * two can never drift on a bound or a description.
 *
 * The subset is the Hub's (`UpdateFeedbackRecordInputBody` in hub 0.8.1): a record's provenance is
 * immutable, so `source_*`, `field_*`, `submission_id` and `collected_at` cannot be changed — correcting
 * those means deleting and recreating. The Hub also refuses to accept the derived enrichment fields
 * (`sentiment`, `emotions`, translations) from a caller, so there is nothing to exclude there.
 *
 * At least one field is required: an empty patch is a caller mistake, not a no-op worth a round trip.
 */
export const ZV3FeedbackRecordUpdateBody = ZV3FeedbackRecordCreateBodyFields.pick({
  value_text: true,
  value_number: true,
  value_boolean: true,
  value_date: true,
  value_id: true,
  user_id: true,
  language: true,
  metadata: true,
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "at least one field to update is required",
});
export type TV3FeedbackRecordUpdateBody = z.infer<typeof ZV3FeedbackRecordUpdateBody>;

/** The plain object form, for `inputSchema` shapes which need a raw shape rather than a refined schema. */
export const ZV3FeedbackRecordUpdateBodyFields = ZV3FeedbackRecordCreateBodyFields.pick({
  value_text: true,
  value_number: true,
  value_boolean: true,
  value_date: true,
  value_id: true,
  user_id: true,
  language: true,
  metadata: true,
});

/**
 * Batch create. The Hub has no bulk-create endpoint (its only bulk write is the delete-by-user erasure
 * path), so this fans out to one Hub call per record. The cap is therefore an amplification bound as much
 * as a payload bound: one authorized request must not turn into an unbounded burst of upstream writes.
 *
 * 50 covers the case this exists for — importing a batch of feedback without one round trip per record —
 * and stays well inside the 2 MiB request-body limit even with sizeable metadata on every record.
 */
export const MAX_FEEDBACK_RECORDS_PER_BATCH = 50;

export const ZV3FeedbackRecordBatchCreateBody = z.object({
  records: z
    .array(ZV3FeedbackRecordCreateBody)
    .min(1)
    .max(MAX_FEEDBACK_RECORDS_PER_BATCH)
    .describe(
      `Feedback records to create, 1–${MAX_FEEDBACK_RECORDS_PER_BATCH} per call. Every record is validated before any of them is written, so an invalid record fails the whole call without a partial write.`
    ),
});
export type TV3FeedbackRecordBatchCreateBody = z.infer<typeof ZV3FeedbackRecordBatchCreateBody>;
