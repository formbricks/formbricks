import type { SegmentOrderByWithRelationInput, SegmentWhereInput } from "@formbricks/database/prisma";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import type { TV3SegmentSort } from "./parse-v3-segments-list-query";

/**
 * The list filter. Private segments are survey-local targeting drafts, never listed — the Segments page
 * dropped them client-side; here they never leave the database.
 */
export const buildV3SegmentsWhere = (workspaceId: string, search?: string): SegmentWhereInput => ({
  workspaceId,
  isPrivate: false,
  ...(search && { title: { contains: escapeLikePattern(search), mode: "insensitive" } }),
});

const SORT_SPECS: Record<
  TV3SegmentSort,
  { column: "title" | "updatedAt" | "createdAt"; direction: "asc" | "desc" }
> = {
  name: { column: "title", direction: "asc" },
  "-updatedAt": { column: "updatedAt", direction: "desc" },
  "-createdAt": { column: "createdAt", direction: "desc" },
};

export const buildV3SegmentsOrderBy = (sortBy: TV3SegmentSort): SegmentOrderByWithRelationInput[] => {
  const { column, direction } = SORT_SPECS[sortBy];
  return [{ [column]: direction }, { id: direction }];
};

/** The keyset condition for the page after `cursor`, matching {@link buildV3SegmentsOrderBy}. */
export const buildV3SegmentsCursorWhere = (
  cursor: { value: string; id: string },
  sortBy: TV3SegmentSort
): SegmentWhereInput => {
  const { column, direction } = SORT_SPECS[sortBy];
  const comparison = direction === "desc" ? "lt" : "gt";
  const value = column === "title" ? cursor.value : new Date(cursor.value);
  return {
    OR: [{ [column]: { [comparison]: value } }, { [column]: value, id: { [comparison]: cursor.id } }],
  };
};

/** The sort value a row contributes to the next cursor, in the form the cursor stores it. */
export const segmentSortValue = (
  row: { title: string; updatedAt: Date; createdAt: Date },
  sortBy: TV3SegmentSort
): string => {
  const { column } = SORT_SPECS[sortBy];
  return column === "title" ? row.title : row[column].toISOString();
};
