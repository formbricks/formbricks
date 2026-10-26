import type {
  TBaseFilters,
  TSegmentSurveyReference,
  TSegmentWithSurveyRefs,
} from "@formbricks/types/segment";

/**
 * Public v3 segment. The same fields the Segments page hands `SegmentTable` / `EditSegmentModal` today
 * (`TSegmentWithSurveyRefs`), with the dates as ISO 8601 strings, so the page can move to this endpoint
 * without losing anything. `surveys`, `activeSurveys` and `inactiveSurveys` only ever name surveys the
 * caller may see (ENG-3282).
 */
export type TV3SegmentResource = {
  id: string;
  title: string;
  description: string | null;
  isPrivate: boolean;
  filters: TBaseFilters;
  workspaceId: string;
  surveys: string[];
  activeSurveys: TSegmentSurveyReference[];
  inactiveSurveys: TSegmentSurveyReference[];
  createdAt: string;
  updatedAt: string;
};

export function serializeV3Segment(segment: TSegmentWithSurveyRefs): TV3SegmentResource {
  return {
    id: segment.id,
    title: segment.title,
    description: segment.description,
    isPrivate: segment.isPrivate,
    filters: segment.filters,
    workspaceId: segment.workspaceId,
    surveys: segment.surveys,
    activeSurveys: segment.activeSurveys,
    inactiveSurveys: segment.inactiveSurveys,
    createdAt: segment.createdAt.toISOString(),
    updatedAt: segment.updatedAt.toISOString(),
  };
}
