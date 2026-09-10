import { z } from "zod";
import {
  type TKeysetCursor,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";

/**
 * Query parsing for `GET /api/v3/responses` and `GET /api/v3/responses/count`.
 *
 * Separate from the operations for the reason `parse-v3-surveys-list-query.ts` is: the two endpoints
 * share every scoping and filter rule, and only differ in what they do with the result. Keeping the
 * rules in one place is what stops the count from drifting away from the list it is supposed to be
 * counting.
 *
 * Two things live here rather than deeper down, both because of the status code they owe:
 *
 * - **Unknown query parameters are refused**, per the v3 rule that an undeclared key is a 400 naming
 *   the key. That has to happen before parsing, or an unknown key is silently ignored instead.
 * - **The cursor is decoded here.** `decodeKeysetCursor` throws `InvalidInputError`, which
 *   `mapV3ThrownError` deliberately does not map — so decoding it in a service would answer 500
 *   where the contract promises a 400 naming `cursor`.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 250;

/** The most ids `filter[id][in]` accepts, matching the contract and the batch-delete cap. */
const MAX_ID_FILTER = 100;

/** The collection this endpoint's cursors belong to, so another collection's token cannot validate. */
export const RESPONSES_CURSOR_KIND = "responses";

const CREATED_AT_GTE = "filter[createdAt][gte]" as const;
const CREATED_AT_GT = "filter[createdAt][gt]" as const;
const CREATED_AT_LTE = "filter[createdAt][lte]" as const;
const CREATED_AT_LT = "filter[createdAt][lt]" as const;
const FINISHED_EQ = "filter[finished][eq]" as const;
const LANGUAGE_IN = "filter[language][in]" as const;
const ID_IN = "filter[id][in]" as const;

/**
 * Every key the list accepts. `/count` accepts this set minus the four paging keys — it returns a
 * number, so a limit, a cursor, a sort order and a total-count flag would all be meaningless, and
 * accepting them silently would let a caller believe the count respected them.
 */
const LIST_QUERY_PARAMS = [
  "workspaceId",
  "limit",
  "cursor",
  "surveyId",
  "contactId",
  "includeTotalCount",
  CREATED_AT_GTE,
  CREATED_AT_GT,
  CREATED_AT_LTE,
  CREATED_AT_LT,
  FINISHED_EQ,
  LANGUAGE_IN,
  ID_IN,
  "sortBy",
] as const;

const PAGING_ONLY_PARAMS = new Set<string>(["limit", "cursor", "includeTotalCount", "sortBy"]);

const COUNT_QUERY_PARAMS = [
  ...LIST_QUERY_PARAMS.filter((key) => !PAGING_ONLY_PARAMS.has(key)),
  "precision",
] as const;

export type TV3InvalidParam = { name: string; reason: string };

/** The scope and filters, normalized — what the service turns into SQL and the fingerprint covers. */
export interface TV3ResponsesFilter {
  workspaceId: string;
  surveyId?: string;
  contactId?: string;
  createdAtGte?: Date;
  createdAtGt?: Date;
  createdAtLte?: Date;
  createdAtLt?: Date;
  finished?: boolean;
  languages?: string[];
  ids?: string[];
}

export type TV3ResponsesSort = "-createdAt" | "createdAt";

export type TV3ResponsesListQueryParseResult =
  | {
      ok: true;
      filter: TV3ResponsesFilter;
      limit: number;
      cursor: TKeysetCursor | null;
      includeTotalCount: boolean;
      sortBy: TV3ResponsesSort;
      /** The fingerprint the page's `nextCursor` must carry. */
      fingerprint: string;
    }
  | { ok: false; invalid_params: TV3InvalidParam[] };

export type TV3ResponsesCountQueryParseResult =
  | { ok: true; filter: TV3ResponsesFilter; precision: "capped" | "exact" }
  | { ok: false; invalid_params: TV3InvalidParam[] };

const cuid2 = z.cuid2();

/**
 * A language code, not a BCP-47 locale.
 *
 * The contract is explicit that these are the survey's own codes and that the literal `default` is a
 * legitimate value, so running them through a locale parser would reject a real filter.
 */
const languageCode = z.string().min(1).max(64);

const ZDateBound = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const ZScope = {
  workspaceId: cuid2,
  surveyId: cuid2.optional(),
  contactId: cuid2.optional(),
  [CREATED_AT_GTE]: ZDateBound.optional(),
  [CREATED_AT_GT]: ZDateBound.optional(),
  [CREATED_AT_LTE]: ZDateBound.optional(),
  [CREATED_AT_LT]: ZDateBound.optional(),
  [FINISHED_EQ]: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  [LANGUAGE_IN]: z.array(languageCode).min(1).optional(),
  [ID_IN]: z.array(cuid2).min(1).max(MAX_ID_FILTER).optional(),
};

const ZListQuery = z.object({
  ...ZScope,
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
  includeTotalCount: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  sortBy: z.enum(["-createdAt", "createdAt"]).default("-createdAt"),
});

const ZCountQuery = z.object({
  ...ZScope,
  precision: z.enum(["capped", "exact"]).default("capped"),
});

/** Repeated keys and comma-separated values both spell a multi-value filter, as elsewhere in v3. */
const collectMultiValue = (searchParams: URLSearchParams, key: string): string[] => {
  const values: string[] = [];

  for (const raw of searchParams.getAll(key)) {
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (trimmed) values.push(trimmed);
    }
  }

  return [...new Set(values)];
};

const unsupportedParams = (
  searchParams: URLSearchParams,
  supported: readonly string[]
): TV3InvalidParam[] => {
  const allowed = new Set<string>(supported);
  const seen = [...new Set([...searchParams.keys()].filter((key) => !allowed.has(key)))];

  return seen.map((name) => ({
    name,
    reason: `Unsupported query parameter. Use only ${supported.join(", ")}.`,
  }));
};

const issuesToInvalidParams = (error: z.ZodError): TV3InvalidParam[] =>
  error.issues.map((issue) => ({
    name: issue.path.join(".") || "query",
    reason: issue.message,
  }));

const readScope = (searchParams: URLSearchParams) => {
  const languages = collectMultiValue(searchParams, LANGUAGE_IN);
  const ids = collectMultiValue(searchParams, ID_IN);

  return {
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    surveyId: searchParams.get("surveyId")?.trim() || undefined,
    contactId: searchParams.get("contactId")?.trim() || undefined,
    [CREATED_AT_GTE]: searchParams.get(CREATED_AT_GTE)?.trim() || undefined,
    [CREATED_AT_GT]: searchParams.get(CREATED_AT_GT)?.trim() || undefined,
    [CREATED_AT_LTE]: searchParams.get(CREATED_AT_LTE)?.trim() || undefined,
    [CREATED_AT_LT]: searchParams.get(CREATED_AT_LT)?.trim() || undefined,
    [FINISHED_EQ]: searchParams.get(FINISHED_EQ)?.trim() || undefined,
    [LANGUAGE_IN]: languages.length > 0 ? languages : undefined,
    [ID_IN]: ids.length > 0 ? ids : undefined,
  };
};

/**
 * The shared scope fields, inferred on their own rather than off either endpoint's schema — both
 * parse supersets of it, and typing this off the count schema made the list's parsed data
 * unassignable because it carries no `precision`.
 */
type TParsedScope = z.infer<z.ZodObject<typeof ZScope>>;

const toFilter = (parsed: TParsedScope): TV3ResponsesFilter => ({
  workspaceId: parsed.workspaceId,
  surveyId: parsed.surveyId,
  contactId: parsed.contactId,
  createdAtGte: parsed[CREATED_AT_GTE],
  createdAtGt: parsed[CREATED_AT_GT],
  createdAtLte: parsed[CREATED_AT_LTE],
  createdAtLt: parsed[CREATED_AT_LT],
  finished: parsed[FINISHED_EQ],
  languages: parsed[LANGUAGE_IN],
  ids: parsed[ID_IN],
});

/**
 * The two cross-field rules the contract states, checked together so a caller breaking both is told
 * both at once rather than discovering the second after fixing the first.
 *
 * The anchor rule is a performance boundary made explicit: `finished` and `language` are heap
 * residuals, bounded only when the scan is anchored to one survey or one contact. Without an anchor
 * the honest outcome on a large workspace is a timeout, so the contract refuses rather than serving
 * one slowly.
 */
const crossFieldIssues = (filter: TV3ResponsesFilter): TV3InvalidParam[] => {
  const issues: TV3InvalidParam[] = [];
  const anchored = filter.surveyId !== undefined || filter.contactId !== undefined;

  if (filter.finished !== undefined && !anchored) {
    issues.push({
      name: FINISHED_EQ,
      reason: "Requires surveyId or contactId, because the filter is only bounded by one of them.",
    });
  }

  if (filter.languages !== undefined && !anchored) {
    issues.push({
      name: LANGUAGE_IN,
      reason: "Requires surveyId or contactId, because the filter is only bounded by one of them.",
    });
  }

  // Refused rather than resolved by precedence: a caller sending both forms of one bound has a bug,
  // and picking one for them would hide it behind a plausible-looking page.
  if (filter.createdAtGte !== undefined && filter.createdAtGt !== undefined) {
    issues.push({ name: CREATED_AT_GT, reason: `Cannot be combined with ${CREATED_AT_GTE}.` });
  }

  if (filter.createdAtLte !== undefined && filter.createdAtLt !== undefined) {
    issues.push({ name: CREATED_AT_LT, reason: `Cannot be combined with ${CREATED_AT_LTE}.` });
  }

  const lower = filter.createdAtGte ?? filter.createdAtGt;
  const upper = filter.createdAtLte ?? filter.createdAtLt;

  if (lower && upper && lower > upper) {
    issues.push({
      name: CREATED_AT_GTE,
      reason: "The lower bound must not be later than the upper bound.",
    });
  }

  return issues;
};

/**
 * What the cursor's fingerprint covers: the authorized scope and every allow-listed filter.
 *
 * Deliberately not `limit`, `sortBy`, `includeTotalCount` or `precision`. `sortBy` is bound
 * separately by the cursor's own field, and the other three are presentation: AIP-158 requires a
 * changed page size to be honoured mid-walk rather than invalidating the position.
 */
const fingerprintOf = (filter: TV3ResponsesFilter): string =>
  computeFilterFingerprint({
    workspaceId: filter.workspaceId,
    surveyId: filter.surveyId,
    contactId: filter.contactId,
    createdAtGte: filter.createdAtGte?.toISOString(),
    createdAtGt: filter.createdAtGt?.toISOString(),
    createdAtLte: filter.createdAtLte?.toISOString(),
    createdAtLt: filter.createdAtLt?.toISOString(),
    finished: filter.finished,
    languages: filter.languages,
    ids: filter.ids,
  });

export const parseV3ResponsesListQuery = (
  searchParams: URLSearchParams
): TV3ResponsesListQueryParseResult => {
  const unsupported = unsupportedParams(searchParams, LIST_QUERY_PARAMS);
  if (unsupported.length > 0) {
    return { ok: false, invalid_params: unsupported };
  }

  const parsed = ZListQuery.safeParse({
    ...readScope(searchParams),
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor")?.trim() || undefined,
    includeTotalCount: searchParams.get("includeTotalCount")?.trim() || undefined,
    sortBy: searchParams.get("sortBy")?.trim() || undefined,
  });

  if (!parsed.success) {
    return { ok: false, invalid_params: issuesToInvalidParams(parsed.error) };
  }

  const filter = toFilter(parsed.data);
  const crossField = crossFieldIssues(filter);
  if (crossField.length > 0) {
    return { ok: false, invalid_params: crossField };
  }

  const fingerprint = fingerprintOf(filter);
  let cursor: TKeysetCursor | null = null;

  if (parsed.data.cursor) {
    try {
      cursor = decodeKeysetCursor(parsed.data.cursor, {
        kind: RESPONSES_CURSOR_KIND,
        sortBy: parsed.data.sortBy,
        fp: fingerprint,
      });
    } catch (error) {
      return {
        ok: false,
        invalid_params: [
          { name: "cursor", reason: error instanceof Error ? error.message : "The cursor is invalid." },
        ],
      };
    }
  }

  return {
    ok: true,
    filter,
    limit: parsed.data.limit,
    cursor,
    includeTotalCount: parsed.data.includeTotalCount,
    sortBy: parsed.data.sortBy,
    fingerprint,
  };
};

export const parseV3ResponsesCountQuery = (
  searchParams: URLSearchParams
): TV3ResponsesCountQueryParseResult => {
  const unsupported = unsupportedParams(searchParams, COUNT_QUERY_PARAMS);
  if (unsupported.length > 0) {
    return { ok: false, invalid_params: unsupported };
  }

  const parsed = ZCountQuery.safeParse({
    ...readScope(searchParams),
    precision: searchParams.get("precision")?.trim() || undefined,
  });

  if (!parsed.success) {
    return { ok: false, invalid_params: issuesToInvalidParams(parsed.error) };
  }

  const filter = toFilter(parsed.data);
  const crossField = crossFieldIssues(filter);
  if (crossField.length > 0) {
    return { ok: false, invalid_params: crossField };
  }

  return { ok: true, filter, precision: parsed.data.precision };
};
