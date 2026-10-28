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

export const SEGMENT_SORT_VALUES = ["-updatedAt", "-createdAt", "title"] as const;
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
  if (search.trim()) searchParams.set("filter[title][contains]", search.trim());
  // The match count only needs computing for the first page of a search.
  if (cursor) searchParams.set("cursor", cursor);
  else searchParams.set("includeTotalCount", "true");
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
