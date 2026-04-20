/**
 * Validates GET /api/v3/surveys query string and builds {@link TSurveyFilterCriteria} for list/count.
 * Keeps HTTP parsing separate from the route handler and shared survey list service.
 */
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  type TSurveyFilterCriteria,
  ZSurveyFilters,
  ZSurveyStatus,
  ZSurveyType,
} from "@formbricks/types/surveys/types";
import {
  type TSurveyListPageCursor,
  type TSurveyListSort,
  decodeSurveyListPageCursor,
  normalizeSurveyListSort,
} from "@/modules/survey/list/lib/survey-page";

const V3_SURVEYS_DEFAULT_LIMIT = 20;
const V3_SURVEYS_MAX_LIMIT = 100;

const FILTER_NAME_CONTAINS_QUERY_PARAM = "filter[name][contains]" as const;
const FILTER_STATUS_IN_QUERY_PARAM = "filter[status][in]" as const;
const FILTER_TYPE_IN_QUERY_PARAM = "filter[type][in]" as const;

const SUPPORTED_QUERY_PARAMS = [
  "workspaceId",
  "limit",
  "cursor",
  FILTER_NAME_CONTAINS_QUERY_PARAM,
  FILTER_STATUS_IN_QUERY_PARAM,
  FILTER_TYPE_IN_QUERY_PARAM,
  "sortBy",
] as const;
const SUPPORTED_QUERY_PARAM_SET = new Set<string>(SUPPORTED_QUERY_PARAMS);

type InvalidParam = { name: string; reason: string };

/** Collect repeated query keys and comma-separated values for operator-style filters. */
export function collectMultiValueQueryParam(searchParams: URLSearchParams, key: string): string[] {
  const acc: string[] = [];
  for (const raw of searchParams.getAll(key)) {
    for (const part of raw.split(",")) {
      const t = part.trim();
      if (t) acc.push(t);
    }
  }
  return [...new Set(acc)];
}

const ZV3SurveysListQuery = z.object({
  workspaceId: ZId,
  limit: z.coerce.number().int().min(1).max(V3_SURVEYS_MAX_LIMIT).default(V3_SURVEYS_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
  [FILTER_NAME_CONTAINS_QUERY_PARAM]: z
    .string()
    .max(512)
    .optional()
    .transform((s) => (s === undefined || s.trim() === "" ? undefined : s.trim())),
  [FILTER_STATUS_IN_QUERY_PARAM]: z.array(ZSurveyStatus).optional(),
  [FILTER_TYPE_IN_QUERY_PARAM]: z.array(ZSurveyType).optional(),
  sortBy: ZSurveyFilters.shape.sortBy.optional(),
});

export type TV3SurveysListQuery = z.infer<typeof ZV3SurveysListQuery>;

export type TV3SurveysListQueryParseResult =
  | {
      ok: true;
      workspaceId: string;
      limit: number;
      cursor: TSurveyListPageCursor | null;
      sortBy: TSurveyListSort;
      filterCriteria: TSurveyFilterCriteria | undefined;
    }
  | { ok: false; invalid_params: InvalidParam[] };

function getUnsupportedQueryParams(searchParams: URLSearchParams): InvalidParam[] {
  const unsupportedParams = [
    ...new Set(Array.from(searchParams.keys()).filter((key) => !SUPPORTED_QUERY_PARAM_SET.has(key))),
  ];

  return unsupportedParams.map((name) => ({
    name,
    reason: `Unsupported query parameter. Use only ${SUPPORTED_QUERY_PARAMS.join(", ")}.`,
  }));
}

function buildFilterCriteria(q: TV3SurveysListQuery): TSurveyFilterCriteria | undefined {
  const f: TSurveyFilterCriteria = {};
  if (q[FILTER_NAME_CONTAINS_QUERY_PARAM]) f.name = q[FILTER_NAME_CONTAINS_QUERY_PARAM];
  if (q[FILTER_STATUS_IN_QUERY_PARAM]?.length) f.status = q[FILTER_STATUS_IN_QUERY_PARAM];
  if (q[FILTER_TYPE_IN_QUERY_PARAM]?.length) f.type = q[FILTER_TYPE_IN_QUERY_PARAM];
  return Object.keys(f).length > 0 ? f : undefined;
}

export function parseV3SurveysListQuery(searchParams: URLSearchParams): TV3SurveysListQueryParseResult {
  const unsupportedQueryParams = getUnsupportedQueryParams(searchParams);
  if (unsupportedQueryParams.length > 0) {
    return {
      ok: false,
      invalid_params: unsupportedQueryParams,
    };
  }

  const statusVals = collectMultiValueQueryParam(searchParams, FILTER_STATUS_IN_QUERY_PARAM);
  const typeVals = collectMultiValueQueryParam(searchParams, FILTER_TYPE_IN_QUERY_PARAM);

  const raw = {
    workspaceId: searchParams.get("workspaceId"),
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor")?.trim() || undefined,
    [FILTER_NAME_CONTAINS_QUERY_PARAM]: searchParams.get(FILTER_NAME_CONTAINS_QUERY_PARAM) ?? undefined,
    [FILTER_STATUS_IN_QUERY_PARAM]: statusVals.length > 0 ? statusVals : undefined,
    [FILTER_TYPE_IN_QUERY_PARAM]: typeVals.length > 0 ? typeVals : undefined,
    sortBy: searchParams.get("sortBy")?.trim() || undefined,
  };

  const result = ZV3SurveysListQuery.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      invalid_params: result.error.issues.map((issue) => ({
        name: issue.path.join(".") || "query",
        reason: issue.message,
      })),
    };
  }

  const q = result.data;
  const sortBy = normalizeSurveyListSort(q.sortBy);
  let cursor: TSurveyListPageCursor | null = null;

  if (q.cursor) {
    try {
      cursor = decodeSurveyListPageCursor(q.cursor, sortBy);
    } catch (error) {
      return {
        ok: false,
        invalid_params: [
          {
            name: "cursor",
            reason: error instanceof Error ? error.message : "The cursor is invalid.",
          },
        ],
      };
    }
  }

  return {
    ok: true,
    workspaceId: q.workspaceId,
    limit: q.limit,
    cursor,
    sortBy,
    filterCriteria: buildFilterCriteria(q),
  };
}
