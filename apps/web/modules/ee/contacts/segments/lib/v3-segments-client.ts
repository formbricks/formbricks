import type { TSegmentWithSurveyRefs } from "@formbricks/types/segment";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

type TV3SegmentItem = Omit<TSegmentWithSurveyRefs, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type TSegmentListPage = {
  data: TSegmentWithSurveyRefs[];
  meta: { limit: number; nextCursor: string | null; totalCount: number | null };
};

export const SEGMENT_SORT_VALUES = ["-updatedAt", "-createdAt", "name"] as const;
export const DEFAULT_SEGMENT_SORT = "-updatedAt";

export const listSegments = async ({
  workspaceId,
  limit,
  cursor,
  search,
  sortBy,
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  search: string;
  sortBy: string;
  signal?: AbortSignal;
}): Promise<TSegmentListPage> => {
  const searchParams = new URLSearchParams({ workspaceId, limit: String(limit), sortBy });
  if (search.trim()) searchParams.set("search", search.trim());
  if (cursor) {
    searchParams.set("cursor", cursor);
    // The match count only needs computing for the first page of a search.
    searchParams.set("includeTotalCount", "false");
  }
  const response = await fetch(`/api/v3/segments?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  const body = (await response.json()) as { data: TV3SegmentItem[]; meta: TSegmentListPage["meta"] };
  return {
    data: body.data.map((segment) => ({
      ...segment,
      createdAt: new Date(segment.createdAt),
      updatedAt: new Date(segment.updatedAt),
    })),
    meta: body.meta,
  };
};
