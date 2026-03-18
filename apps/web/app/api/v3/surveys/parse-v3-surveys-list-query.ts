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

const V3_SURVEYS_DEFAULT_LIMIT = 20;
const V3_SURVEYS_MAX_LIMIT = 100;

const SUPPORTED_QUERY_PARAMS = [
  "workspaceId",
  "limit",
  "offset",
  "name",
  "status",
  "type",
  "createdBy",
  "sortBy",
] as const;
const SUPPORTED_QUERY_PARAM_SET = new Set<string>(SUPPORTED_QUERY_PARAMS);

type InvalidParam = { name: string; reason: string };

/** Collect repeated query keys and comma-separated values: `status=a&status=b` or `status=a,b`. */
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
  offset: z.coerce.number().int().min(0).default(0),
  name: z
    .string()
    .max(512)
    .optional()
    .transform((s) => (s === undefined || s.trim() === "" ? undefined : s.trim())),
  status: z.array(ZSurveyStatus).optional(),
  type: z.array(ZSurveyType).optional(),
  createdBy: ZSurveyFilters.shape.createdBy.optional(),
  sortBy: ZSurveyFilters.shape.sortBy.optional(),
});

export type TV3SurveysListQuery = z.infer<typeof ZV3SurveysListQuery>;

export type TV3SurveysListQueryParseResult =
  | {
      ok: true;
      workspaceId: string;
      limit: number;
      offset: number;
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

function buildFilterCriteria(
  q: TV3SurveysListQuery,
  sessionUserId: string | null
): TSurveyFilterCriteria | undefined {
  const f: TSurveyFilterCriteria = {};
  if (q.name) f.name = q.name;
  if (q.status?.length) f.status = q.status;
  if (q.type?.length) f.type = q.type;
  if (q.createdBy?.length && sessionUserId) {
    f.createdBy = { userId: sessionUserId, value: q.createdBy };
  }
  if (q.sortBy) f.sortBy = q.sortBy;
  return Object.keys(f).length > 0 ? f : undefined;
}

export type TV3SurveysListQueryParseOptions = {
  sessionUserId: string | null;
};

export function parseV3SurveysListQuery(
  searchParams: URLSearchParams,
  options: TV3SurveysListQueryParseOptions
): TV3SurveysListQueryParseResult {
  const { sessionUserId } = options;

  const unsupportedQueryParams = getUnsupportedQueryParams(searchParams);
  if (unsupportedQueryParams.length > 0) {
    return {
      ok: false,
      invalid_params: unsupportedQueryParams,
    };
  }

  const statusVals = collectMultiValueQueryParam(searchParams, "status");
  const typeVals = collectMultiValueQueryParam(searchParams, "type");
  const createdByVals = collectMultiValueQueryParam(searchParams, "createdBy");

  if (createdByVals.length > 0 && sessionUserId === null) {
    return {
      ok: false,
      invalid_params: [
        {
          name: "createdBy",
          reason: "The createdBy filter is only supported with session authentication (not API keys).",
        },
      ],
    };
  }

  const raw = {
    workspaceId: searchParams.get("workspaceId"),
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
    name: searchParams.get("name") ?? undefined,
    status: statusVals.length > 0 ? statusVals : undefined,
    type: typeVals.length > 0 ? typeVals : undefined,
    createdBy: createdByVals.length > 0 ? createdByVals : undefined,
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
  return {
    ok: true,
    workspaceId: q.workspaceId,
    limit: q.limit,
    offset: q.offset,
    filterCriteria: buildFilterCriteria(q, sessionUserId),
  };
}
