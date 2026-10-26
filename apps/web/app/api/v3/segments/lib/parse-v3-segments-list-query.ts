import { z } from "zod";
import { computeFilterFingerprint } from "@/app/api/v3/lib/keyset-cursor";
import { type TSortCursor, decodeSortCursor } from "@/app/api/v3/lib/sort-cursor";
import { zPostgresText } from "@/lib/utils/postgres-text";

/**
 * Query parsing for `GET /api/v3/segments`. The cursor is decoded here, bound to the sort order and to
 * a fingerprint of the workspace and search, so a changed sort or search mid-walk is a 400 naming
 * `cursor` rather than a silently wrong page.
 */

export const V3_SEGMENTS_DEFAULT_LIMIT = 50;
export const V3_SEGMENTS_MAX_LIMIT = 250;
export const SEGMENTS_CURSOR_KIND = "segments";

export const V3_SEGMENT_SORTS = ["name", "-updatedAt", "-createdAt"] as const;
export type TV3SegmentSort = (typeof V3_SEGMENT_SORTS)[number];

const SUPPORTED_QUERY_PARAMS = [
  "workspaceId",
  "limit",
  "cursor",
  "includeTotalCount",
  "search",
  "sortBy",
] as const;
const SUPPORTED_QUERY_PARAM_SET = new Set<string>(SUPPORTED_QUERY_PARAMS);

export type TV3InvalidParam = { name: string; reason: string };

export type TV3SegmentsListQuery = {
  workspaceId: string;
  limit: number;
  cursor: TSortCursor | null;
  includeTotalCount: boolean;
  search?: string;
  sortBy: TV3SegmentSort;
  fingerprint: string;
};

const ZQuery = z.object({
  workspaceId: z.cuid2(),
  limit: z.coerce.number().int().min(1).max(V3_SEGMENTS_MAX_LIMIT).default(V3_SEGMENTS_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
  includeTotalCount: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
  search: zPostgresText()
    .max(512)
    .optional()
    .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim())),
  sortBy: z.enum(V3_SEGMENT_SORTS).default("-updatedAt"),
});

export const computeV3SegmentsFingerprint = (workspaceId: string, search: string | undefined): string =>
  computeFilterFingerprint({ workspaceId, search });

export function parseV3SegmentsListQuery(
  searchParams: URLSearchParams
): ({ ok: true } & TV3SegmentsListQuery) | { ok: false; invalid_params: TV3InvalidParam[] } {
  const keys = [...new Set(searchParams.keys())];
  const unsupported = keys.filter((key) => !SUPPORTED_QUERY_PARAM_SET.has(key));
  if (unsupported.length > 0) {
    return {
      ok: false,
      invalid_params: unsupported.map((name) => ({
        name,
        reason: `Unsupported query parameter. Use only ${SUPPORTED_QUERY_PARAMS.join(", ")}.`,
      })),
    };
  }

  const repeated = keys.filter((key) => searchParams.getAll(key).length > 1);
  if (repeated.length > 0) {
    return {
      ok: false,
      invalid_params: repeated.map((name) => ({ name, reason: "Must be sent at most once." })),
    };
  }

  const parsed = ZQuery.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor")?.trim() || undefined,
    includeTotalCount: searchParams.get("includeTotalCount")?.trim() || undefined,
    search: searchParams.get("search") ?? undefined,
    sortBy: searchParams.get("sortBy")?.trim() || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      invalid_params: parsed.error.issues.map((issue) => ({
        name: issue.path.join(".") || "query",
        reason: issue.message,
      })),
    };
  }

  const q = parsed.data;
  const fingerprint = computeV3SegmentsFingerprint(q.workspaceId, q.search);
  let cursor: TSortCursor | null = null;

  if (q.cursor) {
    try {
      cursor = decodeSortCursor(q.cursor, { kind: SEGMENTS_CURSOR_KIND, sortBy: q.sortBy, fp: fingerprint });
      // A timestamp sort's position must be an instant, or the page query would bind an Invalid Date.
      if (q.sortBy !== "name" && !z.iso.datetime().safeParse(cursor.value).success) {
        throw new Error("The cursor is invalid.");
      }
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
    workspaceId: q.workspaceId,
    limit: q.limit,
    cursor,
    includeTotalCount: q.includeTotalCount,
    search: q.search,
    sortBy: q.sortBy,
    fingerprint,
  };
}
