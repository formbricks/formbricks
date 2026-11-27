import type { TBaseFilters, TSegment } from "@formbricks/types/segment";

/**
 * A segment, as the segment dialogs and the survey editor's targeting card hold it. Dates travel as ISO
 * strings. The names of the surveys it is connected to are left out: the services read them unscoped, and
 * no caller of these routes shows them.
 */
export type TSegmentResource = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string | null;
  isPrivate: boolean;
  filters: TBaseFilters;
  workspaceId: string;
  surveys: string[];
};

export const serializeSegment = (segment: TSegment): TSegmentResource => ({
  id: segment.id,
  createdAt: segment.createdAt.toISOString(),
  updatedAt: segment.updatedAt.toISOString(),
  title: segment.title,
  description: segment.description,
  isPrivate: segment.isPrivate,
  filters: segment.filters,
  workspaceId: segment.workspaceId,
  surveys: segment.surveys,
});

/** The segment a survey targets, after it was attached or reset. */
export type TSurveySegmentResource = {
  surveyId: string;
  segment: TSegmentResource;
};

/** A survey a survey-interaction filter can name, for the segment editor's survey picker. */
export type TSegmentFilterSurveyResource = {
  id: string;
  name: string;
  status: string;
};
