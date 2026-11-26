import type { TBaseFilter, TBaseFilters, TSegmentSurveyInteractionFilter } from "@formbricks/types/segment";

// The survey ids inside a segment's survey-interaction filters, and keeping the ones a caller may not
// see out of what they read and in what they save (ENG-3282).

const isFilterGroup = (resource: TBaseFilter["resource"]): resource is TBaseFilters =>
  Array.isArray(resource);

const isSurveyInteraction = (
  resource: TBaseFilter["resource"]
): resource is TSegmentSurveyInteractionFilter =>
  !!resource && !Array.isArray(resource) && resource.root?.type === "surveyInteraction";

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

type TSurveyInteractionTerms = {
  operator: string | undefined;
  scope: string | undefined;
  amount: number | undefined;
  unit: string | undefined;
};

const termsOf = (resource: TSegmentSurveyInteractionFilter): TSurveyInteractionTerms => ({
  operator: resource.qualifier?.operator,
  scope: resource.value?.surveyScope,
  amount: resource.value?.within?.amount,
  unit: resource.value?.within?.unit,
});

const sameTerms = (a: TSurveyInteractionTerms, b: TSurveyInteractionTerms): boolean =>
  a.operator === b.operator && a.scope === b.scope && a.amount === b.amount && a.unit === b.unit;

const sameIds = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
};

/** Every filter node of a tree, groups included, at any depth. Defensive: draft trees are not parsed. */
function* walkFilters(filters: unknown): Generator<TBaseFilter> {
  if (!Array.isArray(filters)) return;
  for (const filter of filters as TBaseFilter[]) {
    if (!filter || typeof filter !== "object") continue;
    yield filter;
    if (Array.isArray(filter.resource)) yield* walkFilters(filter.resource);
  }
}

const countFilterIds = (filters: TBaseFilters): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const filter of walkFilters(filters)) counts.set(filter.id, (counts.get(filter.id) ?? 0) + 1);
  return counts;
};

/**
 * ENG-6955: the ids of the survey-interaction filters of `incoming` that carry their stored survey ids
 * over unchanged. A filter is unchanged only if all of these hold:
 * - its id appears exactly once in `incoming` and exactly once in `stored`;
 * - the incoming node is a survey-interaction filter with the stored filter's operator, survey scope and
 *   `within` (a missing `within` only matches a missing one);
 * - its survey ids are unchanged: the same set as stored or, with `visibleSurveyIds`, the same set as the
 *   stored ids the caller can see (an editor only ever holds those). Adding or removing a visible survey
 *   therefore counts as a change, so a hidden one cannot be isolated or recombined by editing around it.
 *
 * Anything else is a new rule, so a survey the caller cannot see may not ride along in it. The filter's
 * connector and position (including moving it into or out of a group) are intentionally not compared:
 * they are equivalent to editing its siblings, which a caller may always do (agreed rule).
 *
 * Both the segment update (`restoreHiddenSurveyIds`) and the survey save (`getAddedSegmentSurveyIds`)
 * decide with it.
 */
export function findUnchangedSurveyFilterIds(
  incoming: TBaseFilters,
  stored: TBaseFilters,
  visibleSurveyIds?: ReadonlySet<string>
): Set<string> {
  const incomingCounts = countFilterIds(incoming);
  const storedCounts = countFilterIds(stored);
  const incomingLeaves = new Map<string, TSegmentSurveyInteractionFilter>();
  for (const { id, resource } of walkFilters(incoming)) {
    if (isSurveyInteraction(resource)) incomingLeaves.set(id, resource);
  }

  const unchanged = new Set<string>();
  for (const { id, resource } of walkFilters(stored)) {
    if (!isSurveyInteraction(resource)) continue;
    if (incomingCounts.get(id) !== 1 || storedCounts.get(id) !== 1) continue;
    const next = incomingLeaves.get(id);
    if (!next || !sameTerms(termsOf(next), termsOf(resource))) continue;
    const storedIds = resource.value?.surveyIds ?? [];
    const comparable = visibleSurveyIds
      ? storedIds.filter((surveyId) => visibleSurveyIds.has(surveyId))
      : storedIds;
    if (sameIds(next.value?.surveyIds ?? [], comparable)) unchanged.add(id);
  }
  return unchanged;
}

/**
 * The survey ids `incoming` names in `specific` survey-interaction filters that do not carry their stored
 * ids over unchanged (ENG-6955), filter by filter: a survey the stored tree also reads through a sibling
 * filter or a nested segment does not make an edited filter's id "old". Nested segments are not followed.
 */
export function collectChangedFilterSurveyIds(
  incoming: TBaseFilters,
  unchanged: ReadonlySet<string>
): string[] {
  const ids: string[] = [];
  for (const { id, resource } of walkFilters(incoming)) {
    if (!isSurveyInteraction(resource) || unchanged.has(id)) continue;
    if (resource.value?.surveyScope !== "specific" || !Array.isArray(resource.value.surveyIds)) continue;
    ids.push(...resource.value.surveyIds);
  }
  return ids;
}

/**
 * The ids of stored survey-interaction filters that hold a survey the caller cannot see and that the
 * incoming tree still names in a `specific` survey-interaction filter, but not carried over unchanged
 * (edited, or duplicated). Restoring them would let the caller reshape a rule around a survey they cannot
 * see, so the update is refused (ENG-6955). A filter that became `any`, another type or a group is a
 * removal: its hidden ids are dropped, as the survey save path reads nothing from it either.
 */
export function findBlockedHiddenFilterIds(
  incoming: TBaseFilters,
  stored: TBaseFilters,
  visibleSurveyIds: ReadonlySet<string>,
  unchanged: ReadonlySet<string> = findUnchangedSurveyFilterIds(incoming, stored, visibleSurveyIds)
): string[] {
  const specificIds = new Set<string>();
  for (const { id, resource } of walkFilters(incoming)) {
    if (isSurveyInteraction(resource) && resource.value?.surveyScope === "specific") specificIds.add(id);
  }
  const blocked: string[] = [];
  for (const { id, resource } of walkFilters(stored)) {
    if (!isSurveyInteraction(resource) || !specificIds.has(id) || unchanged.has(id)) continue;
    if (resource.value.surveyIds.some((surveyId) => !visibleSurveyIds.has(surveyId))) blocked.push(id);
  }
  return blocked;
}

/**
 * The saved tree with the survey ids the caller could not see put back. The editor only ever held the
 * redacted tree, so a save would otherwise drop those ids: narrowing a positive rule, and widening a
 * negative one (`haveNotSeen`) to contacts who interacted with a survey the editor never saw. Ids go
 * back into the filter they came from, matched by filter id and only while that filter is carried over
 * unchanged (`findUnchangedSurveyFilterIds`, ENG-6955); a filter the caller removed takes its hidden ids
 * with it.
 */
export function restoreHiddenSurveyIds(
  incoming: TBaseFilters,
  stored: TBaseFilters,
  visibleSurveyIds: ReadonlySet<string>,
  unchanged: ReadonlySet<string> = findUnchangedSurveyFilterIds(incoming, stored, visibleSurveyIds)
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
      const hidden = unchanged.has(filter.id) ? hiddenByFilterId.get(filter.id) : undefined;
      if (!hidden || !isSurveyInteraction(resource)) return filter;
      const surveyIds = [...new Set([...resource.value.surveyIds, ...hidden])];
      return { ...filter, resource: { ...resource, value: { ...resource.value, surveyIds } } };
    });
  return restore(incoming);
}
