import type {
  TBaseFilters,
  TSegmentSurveyReference,
  TSegmentWithSurveyRefs,
} from "@formbricks/types/segment";
import { redactSegmentFilterSurveyIds } from "@/modules/ee/contacts/segments/lib/filter-survey-ids";

export { collectSegmentFilterSurveyIds } from "@/modules/ee/contacts/segments/lib/filter-survey-ids";

/**
 * Public v3 segment. The same fields the Segments page hands `SegmentTable` / `EditSegmentModal` today
 * (`TSegmentWithSurveyRefs`), with the dates as ISO 8601 strings, so the page can move to this endpoint
 * without losing anything. `surveys`, `activeSurveys`, `inactiveSurveys` and the survey ids inside
 * `filters` only ever name surveys the caller may see (ENG-3282).
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

export function serializeV3Segment(
  segment: TSegmentWithSurveyRefs,
  visibleSurveyIds: ReadonlySet<string>
): TV3SegmentResource {
  return {
    id: segment.id,
    title: segment.title,
    description: segment.description,
    isPrivate: segment.isPrivate,
    filters: redactSegmentFilterSurveyIds(segment.filters, visibleSurveyIds),
    workspaceId: segment.workspaceId,
    surveys: segment.surveys,
    activeSurveys: segment.activeSurveys,
    inactiveSurveys: segment.inactiveSurveys,
    createdAt: segment.createdAt.toISOString(),
    updatedAt: segment.updatedAt.toISOString(),
  };
}
