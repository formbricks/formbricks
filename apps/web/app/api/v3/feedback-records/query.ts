/**
 * The documented query string of the REST feedback-record operations, and its translation into the
 * operations layer's own parameters.
 *
 * Two vocabularies meet here. Outward, v3 spells a filter `filter[<member>][<op>]` with the member named
 * exactly as it appears on a record — `filter[userId][in]` filters the `userId` you just read back — and
 * enum values in camelCase. Inward, the operations keep the Hub's spelling, because the MCP tools call
 * them directly and their results are read against the Hub's own documentation. This module is the one
 * place that maps between the two, in both directions.
 *
 * The schemas are named after the documented parameters rather than the internal ones on purpose: the API
 * wrapper reports a validation failure by its Zod path, so `filter[sentiment][in]` is what a caller sees
 * named in `invalid_params` — a caller must never be told about a parameter it did not send.
 */
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZHubEmotion, ZHubFieldType, ZHubSentiment } from "@formbricks/types/feedback-source";
import {
  type TV3FeedbackRecordFilters,
  type TV3FeedbackRecordListFilters,
  ZV3FeedbackRecordCreateBodyFields,
  ZV3FeedbackRecordUpdateBodyFields,
} from "./lib/schemas";

/** Mirrors the Hub's own cap on a repeatable string filter. */
const MAX_FILTER_VALUES = 100;
const LIST_LIMIT_MAX = 1000;

/**
 * A repeatable filter (`style: form, explode: true`), so one occurrence arrives as a string and several
 * as an array. Both are handed on unchanged: the operations already accept one-or-many.
 *
 * Deliberately does **not** split on commas. A comma is a legal character in a `sourceName` or a
 * `userId`, so splitting would quietly turn one real value into two that match nothing.
 */
const repeatable = <T extends z.ZodType>(item: T, max: number = MAX_FILTER_VALUES) =>
  z.union([item, z.array(item).min(1).max(max)]).optional();

/**
 * `true` / `false` and nothing else. `z.coerce.boolean()` would read every non-empty string as `true`,
 * so `?filter[hasEmotions][eq]=false` would invert.
 */
const booleanParam = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

/** A numeric bound. Non-numeric text becomes NaN and is rejected rather than silently dropped. */
const numberParam = (min?: number, max?: number) => {
  let schema = z.coerce.number();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return schema.optional();
};

/** A timestamp bound, left opaque here: only the Hub can compare two offsets correctly. */
const timestampParam = z.string().trim().min(1).optional();

/** An identifier-shaped filter value, matching the operations' own bounds. */
const idParam = z.string().trim().min(1).max(255);

/**
 * Documented filter name → the operations' parameter name.
 *
 * The operations' filter object is `.strict()`, so this table is also what stops an undocumented
 * parameter from reaching it: anything not listed here is rejected by the schema below before the
 * translation runs.
 */
const FILTER_TO_OPERATION_PARAM = {
  "filter[sourceType][in]": "source_type",
  "filter[sourceId][in]": "source_id",
  "filter[sourceName][in]": "source_name",
  "filter[fieldType][in]": "field_type",
  "filter[fieldId][in]": "field_id",
  "filter[fieldGroupId][in]": "field_group_id",
  "filter[submissionId][in]": "submission_id",
  "filter[userId][in]": "user_id",
  "filter[valueId][in]": "value_id",
  "filter[language][in]": "language",
  "filter[sentiment][in]": "sentiment",
  "filter[emotions][in]": "emotions",
  "filter[collectedAt][gte]": "since",
  "filter[collectedAt][lte]": "until",
  "filter[createdAt][gte]": "created_since",
  "filter[createdAt][lte]": "created_until",
  "filter[valueDate][gte]": "value_date_min",
  "filter[valueDate][lte]": "value_date_max",
  "filter[valueNumber][gte]": "value_number_min",
  "filter[valueNumber][lte]": "value_number_max",
  "filter[sentimentScore][gte]": "sentiment_score_min",
  "filter[sentimentScore][lte]": "sentiment_score_max",
  "filter[hasSentiment][eq]": "has_sentiment",
  "filter[hasEmotions][eq]": "has_emotions",
  "filter[hasTranslation][eq]": "has_translation",
} as const satisfies Record<string, keyof TV3FeedbackRecordFilters>;

/**
 * v3 requires camelCase enum values; the Hub answers and expects `very_negative`. `sentiment` is the only
 * member of any enum here that is more than one word, so it is the only one needing a translation.
 */
const V3_TO_HUB_SENTIMENT = {
  veryNegative: "very_negative",
  negative: "negative",
  neutral: "neutral",
  positive: "positive",
  veryPositive: "very_positive",
  mixed: "mixed",
} as const satisfies Record<string, z.infer<typeof ZHubSentiment>>;

const ZV3Sentiment = z.enum(Object.keys(V3_TO_HUB_SENTIMENT) as [keyof typeof V3_TO_HUB_SENTIMENT]);

/**
 * `sortBy` carries the direction as a `-` prefix, as elsewhere in v3, where the operations take a column
 * and a direction separately. Default is the newest feedback first.
 */
const SORT_BY_TO_OPERATION_PARAM = {
  collectedAt: { sort: "collected_at", order: "asc" },
  "-collectedAt": { sort: "collected_at", order: "desc" },
  createdAt: { sort: "created_at", order: "asc" },
  "-createdAt": { sort: "created_at", order: "desc" },
} as const satisfies Record<
  string,
  {
    sort: NonNullable<TV3FeedbackRecordListFilters["sort"]>;
    order: NonNullable<TV3FeedbackRecordListFilters["order"]>;
  }
>;

const SORT_BY_DEFAULT = "-collectedAt" as const;

/** The shared filter half of the query string, identical on list and count. */
const filterShape = {
  workspaceId: ZId,
  datasetId: ZId.optional(),
  "filter[sourceType][in]": repeatable(idParam),
  "filter[sourceId][in]": repeatable(idParam),
  "filter[sourceName][in]": repeatable(idParam),
  "filter[fieldType][in]": repeatable(ZHubFieldType, ZHubFieldType.options.length),
  "filter[fieldId][in]": repeatable(idParam),
  "filter[fieldGroupId][in]": repeatable(idParam),
  "filter[submissionId][in]": repeatable(idParam),
  "filter[userId][in]": repeatable(idParam),
  "filter[valueId][in]": repeatable(idParam),
  "filter[language][in]": repeatable(z.string().trim().min(1).max(10)),
  "filter[sentiment][in]": repeatable(ZV3Sentiment, ZV3Sentiment.options.length),
  "filter[emotions][in]": repeatable(ZHubEmotion, ZHubEmotion.options.length),
  "filter[collectedAt][gte]": timestampParam,
  "filter[collectedAt][lte]": timestampParam,
  "filter[createdAt][gte]": timestampParam,
  "filter[createdAt][lte]": timestampParam,
  "filter[valueDate][gte]": timestampParam,
  "filter[valueDate][lte]": timestampParam,
  "filter[valueNumber][gte]": numberParam(),
  "filter[valueNumber][lte]": numberParam(),
  "filter[sentimentScore][gte]": numberParam(-1, 1),
  "filter[sentimentScore][lte]": numberParam(-1, 1),
  "filter[hasSentiment][eq]": booleanParam,
  "filter[hasEmotions][eq]": booleanParam,
  "filter[hasTranslation][eq]": booleanParam,
} as const;

/** `.strict()` so an undocumented or misspelled parameter is a 400 naming it, not a silent no-op. */
export const ZV3FeedbackRecordsCountQuery = z.object(filterShape).strict();

export const ZV3FeedbackRecordsListQuery = z
  .object({
    ...filterShape,
    // Bounds enforced here so an out-of-range value is a 400 naming `limit`; the default is not
    // applied here, because `DEFAULT_LIST_LIMIT` in the operations layer is the one that also serves
    // the MCP tools. Two defaults would mean the same request answered differently per surface.
    limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).optional(),
    cursor: z.string().min(1).optional(),
    sortBy: z
      .enum(Object.keys(SORT_BY_TO_OPERATION_PARAM) as [keyof typeof SORT_BY_TO_OPERATION_PARAM])
      .default(SORT_BY_DEFAULT),
  })
  .strict();

type TFilterQuery = z.infer<typeof ZV3FeedbackRecordsCountQuery>;

/** Translate the documented filters into the operations' parameters, dropping the ones not sent. */
export const toOperationFilters = (query: TFilterQuery): TV3FeedbackRecordFilters => {
  const filters: Record<string, unknown> = {};

  for (const [documented, operationParam] of Object.entries(FILTER_TO_OPERATION_PARAM)) {
    const value = query[documented as keyof TFilterQuery];
    if (value !== undefined) {
      filters[operationParam] = value;
    }
  }

  // The one enum whose values differ between the two vocabularies.
  const sentiment = query["filter[sentiment][in]"];
  if (sentiment !== undefined) {
    filters.sentiment = Array.isArray(sentiment)
      ? sentiment.map((label) => V3_TO_HUB_SENTIMENT[label])
      : V3_TO_HUB_SENTIMENT[sentiment];
  }

  return filters as TV3FeedbackRecordFilters;
};

/** Split `sortBy` back into the column and direction the operations take. */
export const toOperationSort = (sortBy: keyof typeof SORT_BY_TO_OPERATION_PARAM) =>
  SORT_BY_TO_OPERATION_PARAM[sortBy];

/**
 * The record id is a UUIDv7 the store assigned, not one of our cuid2s. Validated here because the
 * operations layer does not: it hands the id straight to the store, and the MCP tools validate it in
 * their own input schema, so the route is the matching gate for the REST surface.
 */
export const ZV3FeedbackRecordIdParams = z.object({
  feedbackRecordId: z.uuid(),
});

/** Scope alone: the operations that read their subject from the path. */
export const ZV3FeedbackRecordScopeQuery = z
  .object({
    workspaceId: ZId,
    datasetId: ZId.optional(),
  })
  .strict();

/** Datasets are listed per workspace, and a dataset cannot scope its own discovery. */
export const ZV3FeedbackDatasetsQuery = z.object({ workspaceId: ZId }).strict();

/**
 * The two similarity searches share their pagination and threshold parameters.
 *
 * No defaults are applied here on purpose: the operations layer owns `SIMILARITY_LIMIT_DEFAULT` and
 * `SIMILARITY_MIN_SCORE_DEFAULT` and applies them to whatever it is not given, so an absent parameter
 * stays absent and there is one place each number lives. The bounds are still enforced here, so an
 * out-of-range value is a 400 naming the parameter rather than a 422 from further in.
 */
export const ZV3FeedbackRecordSimilarityQuery = z
  .object({
    workspaceId: ZId,
    datasetId: ZId.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
    minScore: z.coerce.number().min(0).max(1).optional(),
  })
  .strict();

/** Semantic search takes its scope on the query and only the text in the body. */
export const ZV3FeedbackRecordSemanticSearchBody = z
  .object({
    query: z.string().trim().min(1).max(2000),
  })
  .strict();

/**
 * The documented members of a request body, mapped to the operations layer's names.
 *
 * Derived from the operation schema's own keys rather than listed again: a field added there is
 * accepted here in its v3 spelling automatically, and the two cannot drift into a state where the
 * contract documents a field the operation rejects. (Only the key names are read — `.shape` drops the
 * `.strict()` wrapper, so it is not a schema to validate with.)
 */
const documentedBodyMembers = (shape: Record<string, unknown>): Map<string, string> =>
  new Map(
    Object.keys(shape).map((key) => [key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()), key])
  );

const CREATE_BODY_MEMBERS = documentedBodyMembers(ZV3FeedbackRecordCreateBodyFields.shape);
const UPDATE_BODY_MEMBERS = documentedBodyMembers(ZV3FeedbackRecordUpdateBodyFields.shape);

export type TV3BodyTranslation =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; invalidParams: { name: string; reason: string }[] };

/**
 * Translate a documented request body into the operations layer's spelling.
 *
 * Unknown members are **rejected**, which is what `additionalProperties: false` on both request schemas
 * promises. It also closes the gap that motivated the strict batch schema (ENG-2256): a misspelled
 * field would otherwise be dropped and the call would report success — on a create that means a record
 * stored without the text or the attribution the caller sent.
 *
 * Only top-level keys are touched. `metadata` is caller-owned arbitrary JSON, so re-spelling anything
 * inside it would corrupt data we were asked to store verbatim.
 */
const translateBody = (body: unknown, members: Map<string, string>): TV3BodyTranslation => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, invalidParams: [{ name: "body", reason: "Expected a JSON object." }] };
  }

  const translated: Record<string, unknown> = {};
  const unknown: { name: string; reason: string }[] = [];

  for (const [key, value] of Object.entries(body)) {
    const operationParam = members.get(key);
    if (!operationParam) {
      unknown.push({
        name: key,
        reason: `Unknown field. Expected one of: ${[...members.keys()].sort().join(", ")}.`,
      });
      continue;
    }
    translated[operationParam] = value;
  }

  return unknown.length > 0 ? { ok: false, invalidParams: unknown } : { ok: true, body: translated };
};

export const translateCreateBody = (body: unknown): TV3BodyTranslation =>
  translateBody(body, CREATE_BODY_MEMBERS);

export const translateUpdateBody = (body: unknown): TV3BodyTranslation =>
  translateBody(body, UPDATE_BODY_MEMBERS);

/**
 * Re-spell the field names in a validation problem so they name what the caller actually sent.
 *
 * The operations layer validates bodies — it is shared with the MCP tools, so duplicating its schema
 * here would only give the two somewhere to drift — and it names its own parameters when it refuses.
 * Left alone, a caller that sent the documented `valueText` would be told `value_text` is invalid: a
 * field it has never heard of, in a spelling this API does not use. `InvalidParam.name` is documented
 * as a path to the request field, so the route owes the caller the translation back.
 */
export const respellProblemParams = async (response: Response): Promise<Response> => {
  if (response.status !== 422 || !response.headers.get("content-type")?.includes("problem+json")) {
    return response;
  }

  try {
    const problem = (await response.clone().json()) as { invalid_params?: { name?: string }[] };
    if (!Array.isArray(problem.invalid_params)) {
      return response;
    }

    const respelled = {
      ...problem,
      invalid_params: problem.invalid_params.map((param) =>
        typeof param.name === "string"
          ? { ...param, name: param.name.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()) }
          : param
      ),
    };

    return new Response(JSON.stringify(respelled), {
      status: response.status,
      headers: response.headers,
    });
  } catch {
    // A body we cannot read is one we must not rewrite; the caller is better served by the original.
    return response;
  }
};
