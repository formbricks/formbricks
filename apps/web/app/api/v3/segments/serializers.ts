import type {
  TBaseFilter,
  TBaseFilters,
  TSegmentSurveyInteractionFilter,
  TSegmentSurveyReference,
  TSegmentWithSurveyRefs,
} from "@formbricks/types/segment";

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

const isFilterGroup = (resource: TBaseFilter["resource"]): resource is TBaseFilters =>
  Array.isArray(resource);

const isSurveyInteraction = (
  resource: TBaseFilter["resource"]
): resource is TSegmentSurveyInteractionFilter =>
  !Array.isArray(resource) && resource.root.type === "surveyInteraction";

/** Every survey id a segment's survey-interaction filters name, at any depth. */
export function collectSegmentFilterSurveyIds(filters: TBaseFilters): string[] {
  const ids: string[] = [];
  for (const { resource } of filters) {
    if (isFilterGroup(resource)) ids.push(...collectSegmentFilterSurveyIds(resource));
    else if (isSurveyInteraction(resource)) ids.push(...resource.value.surveyIds);
  }
  return ids;
}

/**
 * The filter tree with every survey id the caller may not see taken out of its survey-interaction
 * filters (ENG-3282) — otherwise `filters` would leak the ids `surveys` already hides. The filter
 * itself stays, so the tree keeps its shape and the caller still sees that a rule exists.
 */
export function redactSegmentFilterSurveyIds(
  filters: TBaseFilters,
  visibleSurveyIds: ReadonlySet<string>
): TBaseFilters {
  return filters.map((filter) => {
    const { resource } = filter;
    if (isFilterGroup(resource)) {
      return { ...filter, resource: redactSegmentFilterSurveyIds(resource, visibleSurveyIds) };
    }
    if (!isSurveyInteraction(resource)) return filter;
    const surveyIds = resource.value.surveyIds.filter((id) => visibleSurveyIds.has(id));
    return { ...filter, resource: { ...resource, value: { ...resource.value, surveyIds } } };
  });
}

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
