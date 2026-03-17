/**
 * Validates GET /api/v3/surveys query string and builds {@link TSurveyFilterCriteria} for list/count.
 * Keeps HTTP parsing separate from the route handler and shared survey list service.
 */
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import type { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";

export const V3_SURVEYS_DEFAULT_LIMIT = 20;
export const V3_SURVEYS_MAX_LIMIT = 100;

const ZStatus = z.enum(["draft", "inProgress", "paused", "completed"]);
const ZType = z.enum(["link", "app"]);
const ZCreatedBy = z.enum(["you", "others"]);
const ZSortBy = z.enum(["createdAt", "updatedAt", "name", "relevance"]);

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
  status: z.array(ZStatus).optional(),
  type: z.array(ZType).optional(),
  createdBy: z.array(ZCreatedBy).optional(),
  sortBy: ZSortBy.optional(),
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
  | { ok: false; invalid_params: Array<{ name: string; reason: string }> };

function buildFilterCriteria(
  q: TV3SurveysListQuery,
  sessionUserId: string
): TSurveyFilterCriteria | undefined {
  const f: TSurveyFilterCriteria = {};
  if (q.name) f.name = q.name;
  if (q.status?.length) f.status = q.status;
  if (q.type?.length) f.type = q.type;
  if (q.createdBy?.length) {
    f.createdBy = { userId: sessionUserId, value: q.createdBy };
  }
  if (q.sortBy) f.sortBy = q.sortBy;
  return Object.keys(f).length > 0 ? f : undefined;
}

export function parseV3SurveysListQuery(
  searchParams: URLSearchParams,
  sessionUserId: string
): TV3SurveysListQueryParseResult {
  if (searchParams.has("filterCriteria")) {
    return {
      ok: false,
      invalid_params: [
        {
          name: "filterCriteria",
          reason:
            "Not supported. Use name, status, type, createdBy, and sortBy as query parameters (see OpenAPI).",
        },
      ],
    };
  }

  const statusVals = collectMultiValueQueryParam(searchParams, "status");
  const typeVals = collectMultiValueQueryParam(searchParams, "type");
  const createdByVals = collectMultiValueQueryParam(searchParams, "createdBy");

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
