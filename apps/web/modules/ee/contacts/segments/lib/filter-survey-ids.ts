import type { TBaseFilter, TBaseFilters, TSegmentSurveyInteractionFilter } from "@formbricks/types/segment";

// The survey ids inside a segment's survey-interaction filters, and keeping the ones a caller may not
// see out of what they read and in what they save (ENG-3282).

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

/**
 * The saved tree with the survey ids the caller could not see put back. The editor only ever held the
 * redacted tree, so a save would otherwise drop those ids: narrowing a positive rule, and widening a
 * negative one (`haveNotSeen`) to contacts who interacted with a survey the editor never saw. Ids go
 * back into the filter they came from, matched by filter id; a filter the caller removed takes its
 * hidden ids with it.
 */
export function restoreHiddenSurveyIds(
  incoming: TBaseFilters,
  stored: TBaseFilters,
  visibleSurveyIds: ReadonlySet<string>
): TBaseFilters {
  const hiddenByFilterId = new Map<string, string[]>();
  const collectHidden = (filters: TBaseFilters) => {
    for (const filter of filters) {
      const { resource } = filter;
      if (isFilterGroup(resource)) collectHidden(resource);
      else if (isSurveyInteraction(resource)) {
        const hidden = resource.value.surveyIds.filter((id) => !visibleSurveyIds.has(id));
        if (hidden.length > 0) hiddenByFilterId.set(filter.id, hidden);
      }
    }
  };
  collectHidden(stored);
  if (hiddenByFilterId.size === 0) return incoming;

  const restore = (filters: TBaseFilters): TBaseFilters =>
    filters.map((filter) => {
      const { resource } = filter;
      if (isFilterGroup(resource)) return { ...filter, resource: restore(resource) };
      const hidden = hiddenByFilterId.get(filter.id);
      if (!hidden || !isSurveyInteraction(resource)) return filter;
      const surveyIds = [...new Set([...resource.value.surveyIds, ...hidden])];
      return { ...filter, resource: { ...resource, value: { ...resource.value, surveyIds } } };
    });
  return restore(incoming);
}
