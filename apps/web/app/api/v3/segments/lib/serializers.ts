import type { TV3SegmentResource } from "./schemas";

type TSegmentFields = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const serializeV3SegmentListItem = (segment: TSegmentFields) => ({
  id: segment.id,
  workspaceId: segment.workspaceId,
  title: segment.title,
  description: segment.description,
  createdAt: segment.createdAt.toISOString(),
  updatedAt: segment.updatedAt.toISOString(),
});

export const serializeV3Segment = (
  segment: TSegmentFields & { filters: unknown[] },
  surveys: TV3SegmentResource["surveys"]
): TV3SegmentResource => ({
  ...serializeV3SegmentListItem(segment),
  filters: segment.filters,
  surveys,
});
