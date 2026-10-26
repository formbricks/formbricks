import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { type THubRecordQuery, appendHubQuery } from "./table-filters";

// The Records table reads the public v3 feedbackRecords list and count, which take the Hub's query as
// is (ADR 0003). A workspace can see several feedback directories, each a separate Hub tenant, so the
// table asks each one and merges.

export const RECORDS_PER_PAGE = 50;

type THubListResponse = { data: FeedbackRecordData[]; limit: number; next_cursor?: string | null };

const buildParams = (tenantId: string, query: THubRecordQuery, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ tenant_id: tenantId, ...extra });
  appendHubQuery(params, query);
  return params;
};

export const listDirectoryRecords = async ({
  tenantId,
  query,
  cursor,
  signal,
}: {
  tenantId: string;
  query: THubRecordQuery;
  cursor?: string | null;
  signal?: AbortSignal;
}): Promise<{ records: FeedbackRecordData[]; nextCursor: string | null }> => {
  const params = buildParams(tenantId, query, { limit: String(RECORDS_PER_PAGE) });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/v3/feedbackRecords?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  const body = (await response.json()) as THubListResponse;
  return { records: body.data ?? [], nextCursor: body.next_cursor ?? null };
};

export const countDirectoryRecords = async ({
  tenantId,
  query,
  signal,
}: {
  tenantId: string;
  query: THubRecordQuery;
  signal?: AbortSignal;
}): Promise<number> => {
  // Count takes the filters only; sort and order are list concerns.
  const { sort: _sort, order: _order, ...filters } = query;
  const response = await fetch(`/api/v3/feedbackRecords/count?${buildParams(tenantId, filters).toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  const body = (await response.json()) as { count?: number; data?: { count?: number } };
  return body.count ?? body.data?.count ?? 0;
};

/** Merges pages from several directories into one list in the table's sort order. */
export const sortRecords = (
  records: readonly FeedbackRecordData[],
  query: THubRecordQuery
): FeedbackRecordData[] => {
  const field = query.sort === "created_at" ? "created_at" : "collected_at";
  const direction = query.order === "asc" ? 1 : -1;
  return records.toSorted((a, b) => {
    const left = (a as Record<string, unknown>)[field] as string | undefined;
    const right = (b as Record<string, unknown>)[field] as string | undefined;
    // Ties follow the same direction by id, so the merged order is stable across directories.
    if (left === right) return direction * a.id.localeCompare(b.id);
    return (left ?? "") < (right ?? "") ? -direction : direction;
  });
};
