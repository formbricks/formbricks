import "server-only";
import { type TChartQuery, type TCubeFilter, type TMemberFilter } from "@formbricks/types/analysis";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElementChoice } from "@formbricks/types/surveys/elements";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";

const VALUE_ID_DIMENSION = "FeedbackRecords.valueId";

// ── Option-id resolution helpers ──────────────────────────────────────────────

/** Extract the first `equals` value for a member filter by member name, searching top-level filters only. */
function extractMemberEqualsValue(filters: TCubeFilter[], member: string): string | undefined {
  for (const f of filters) {
    if (
      "member" in f &&
      (f as TMemberFilter).member === member &&
      (f as TMemberFilter).operator === "equals"
    ) {
      const values = (f as TMemberFilter).values;
      if (Array.isArray(values) && values.length > 0) return values[0];
    }
  }
  return undefined;
}

const getChoiceLabelDefault = (choice: { label: TSurveyElementChoice["label"] }): string =>
  getTextContent(getLocalizedValue(choice.label, "default"));

interface TMappingRef {
  elementId: string;
  surveyId: string;
  customFieldLabel?: string | null;
}

type TSurveyLoader = (surveyId: string) => Promise<Awaited<ReturnType<typeof getSurvey>> | undefined>;

export interface TOptionGroupingResult {
  rewrittenQuery: TChartQuery;
  optionLabels?: Record<string, string>;
}

/** Dedupe survey loads so we only call getSurvey once per distinct surveyId within one resolve. */
const createSurveyLoader = (): TSurveyLoader => {
  const cache = new Map<string, Awaited<ReturnType<typeof getSurvey>>>();
  return async (surveyId: string) => {
    if (!cache.has(surveyId)) {
      cache.set(surveyId, await getSurvey(surveyId));
    }
    return cache.get(surveyId);
  };
};

/** Every mapping in the workspace, flattened across feedback sources. */
const getWorkspaceMappings = async (workspaceId: string): Promise<TMappingRef[]> => {
  const feedbackSources = await getFeedbackSourcesWithMappings(workspaceId);
  return feedbackSources.flatMap((source) => source.formbricksMappings);
};

/**
 * Match mappings by the `field_id` a record carries. Elements that expand into one record per
 * option store `field_id = ${elementId}__${optionId}` (multi-select and matrix, see transform.ts),
 * so an exact match on the mapping's elementId misses them — strip the `__` suffix and retry.
 * Element ids are cuids (alphanumeric), so the first `__` is always the separator.
 */
const resolveMappingsByFieldId = (fieldId: string, mappings: TMappingRef[]): TMappingRef[] => {
  const exact = mappings.filter((m) => m.elementId === fieldId);
  if (exact.length > 0) return exact;

  const [elementId] = fieldId.split("__");
  return elementId === fieldId ? [] : mappings.filter((m) => m.elementId === elementId);
};

/**
 * A mapping's effective label is customFieldLabel if set, otherwise the element's
 * default-language headline (mirroring how transform.ts computes field_label on ingest).
 */
const getMappingEffectiveLabel = async (
  mapping: TMappingRef,
  loadSurvey: TSurveyLoader
): Promise<string | undefined> => {
  // Fast path: customFieldLabel is already stored on the mapping. Even if it doesn't match,
  // skip the survey load because the effective label is the custom one, not the headline.
  if (mapping.customFieldLabel !== null && mapping.customFieldLabel !== undefined) {
    return mapping.customFieldLabel;
  }

  const survey = await loadSurvey(mapping.surveyId);
  if (!survey) return undefined;
  const elements = getElementsFromBlocks(survey.blocks);
  const element = elements.find((el) => el.id === mapping.elementId);
  if (!element) return undefined;
  return getTextContent(getLocalizedValue(element.headline ?? {}, "default"));
};

/**
 * Users filter by "Field Label" (fieldLabel) rather than the internal fieldId, so we resolve the
 * label → mappings by matching each mapping's effective label. Several mapped questions can share
 * one label (the same question asked across surveys); all of them are returned and their labels
 * merged, rather than dropping the map because the match was not unique.
 */
const resolveMappingsByFieldLabel = async (
  fieldLabelFilter: string,
  mappings: TMappingRef[],
  loadSurvey: TSurveyLoader
): Promise<TMappingRef[]> => {
  const candidates: TMappingRef[] = [];
  for (const mapping of mappings) {
    const effectiveLabel = await getMappingEffectiveLabel(mapping, loadSurvey);
    if (effectiveLabel === fieldLabelFilter) {
      candidates.push(mapping);
    }
  }
  return candidates;
};

/**
 * Add an element's `value_id` → default-language label pairs to `into`.
 *
 * Which ids an element can produce follows what transform.ts writes on ingest:
 * - single- and multi-select store the matched choice id, plus the stable `"other"` id for
 *   free-text answers when the element offers an other option;
 * - matrix stores the matched *column* id (the row goes into field_id/field_label);
 * - ranking stores the rank as `value_number` and picture selection falls through the generic
 *   path, so neither carries a `value_id` — there is no bucket to label.
 *
 * Existing entries are never overwritten: ids are cuids and cannot collide across elements, but
 * the shared `"other"` id can, and the first mapped element's wording is as good as any.
 */
const collectOptionLabels = (
  element: { type: string; choices?: unknown; columns?: unknown; otherOptionPlaceholder?: unknown },
  into: Record<string, string>
): void => {
  const addAll = (options: unknown): void => {
    if (!Array.isArray(options)) return;
    for (const option of options as { id: string; label: TSurveyElementChoice["label"] }[]) {
      into[option.id] ??= getChoiceLabelDefault(option);
    }
  };

  if (
    element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceMulti
  ) {
    addAll(element.choices);

    // Free-text "other" answers are stored under the stable "other" id (transform.ts). Surveys
    // built in the editor carry an explicit choice with that id, so `addAll` already labelled it;
    // an element that only sets otherOptionPlaceholder still produces the bucket and would
    // otherwise render the bare id. Like every other label in this map, the fallback is
    // default-language text, not the viewer's locale.
    const choices = Array.isArray(element.choices) ? (element.choices as { id: string }[]) : [];
    if (element.otherOptionPlaceholder !== undefined || choices.some((choice) => choice.id === "other")) {
      into.other ??= "Other";
    }
    return;
  }

  if (element.type === TSurveyElementTypeEnum.Matrix) {
    addAll(element.columns);
  }
};

/** Resolve each mapping to its element and merge every option label it can produce. */
const buildOptionLabels = async (
  mappings: TMappingRef[],
  loadSurvey: TSurveyLoader
): Promise<Record<string, string>> => {
  const optionLabels: Record<string, string> = {};
  for (const mapping of mappings) {
    const survey = await loadSurvey(mapping.surveyId);
    if (!survey) continue;
    const element = getElementsFromBlocks(survey.blocks).find((el) => el.id === mapping.elementId);
    if (!element) continue;
    collectOptionLabels(element, optionLabels);
  }
  return optionLabels;
};

/**
 * Ship only the labels a `Value (Option)` grouping actually renders. The map behind it can be
 * built from every mapping in the workspace (see below), and the caller has already narrowed the
 * rows to the feedback directory the viewer may read — so pruning against those rows keeps
 * unrelated surveys' option labels out of the response and off the wire. Groupings that do not
 * carry a value_id pass through untouched; the renderer never consults the map for them.
 */
export const pruneOptionLabels = (
  query: TChartQuery,
  rows: Record<string, unknown>[],
  optionLabels: Record<string, string> | undefined
): Record<string, string> | undefined => {
  if (!optionLabels || !(query.dimensions ?? []).includes(VALUE_ID_DIMENSION)) {
    return optionLabels;
  }

  const used: Record<string, string> = {};
  for (const row of rows) {
    const valueId = row[VALUE_ID_DIMENSION];
    if (typeof valueId === "string" && optionLabels[valueId] !== undefined) {
      used[valueId] = optionLabels[valueId];
    }
  }
  return Object.keys(used).length > 0 ? used : undefined;
};

/**
 * When a query groups by either `FeedbackRecords.valueText` or `FeedbackRecords.valueId`, attach a
 * `{ [value_id]: defaultLabel }` map so the renderer can show human-readable option labels instead
 * of the raw choice ids stored in `value_id`. The dimension the user picked is never rewritten:
 * choice records store one row per option with its own value_id (see transform.ts), so valueText
 * and valueId both group correctly on their own.
 *
 * Which mappings contribute labels:
 * - a `FeedbackRecords.fieldId equals <id>` filter pins the mapping directly (matching the
 *   `${elementId}__${optionId}` form multi-select and matrix records use as well);
 * - otherwise a `FeedbackRecords.fieldLabel equals <label>` filter matches every mapping whose
 *   effective label is that string — several surveys may ask the same question, and all of them
 *   contribute;
 * - when the filters pin nothing and the chart groups by valueId, every mapping in the workspace
 *   contributes. Grouping by valueId with no resolvable label map is exactly the case that renders
 *   bare cuids (ENG-3140), and option ids are cuids, so a wider map cannot mislabel a bucket.
 *   A valueText grouping is readable on its own and does not pay for that widening.
 *
 * Returns `{ rewrittenQuery, optionLabels }`. `rewrittenQuery` is always the original query
 * (kept for caller symmetry); `optionLabels` is omitted when no mapped element carries option ids.
 */
export async function resolveOptionGrouping(
  query: TChartQuery,
  workspaceId: string
): Promise<TOptionGroupingResult> {
  const dimensions = query.dimensions ?? [];
  const hasValueText = dimensions.includes("FeedbackRecords.valueText");
  const hasValueId = dimensions.includes(VALUE_ID_DIMENSION);
  if (!hasValueText && !hasValueId) {
    return { rewrittenQuery: query };
  }

  const fieldId = extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldId");
  const fieldLabelFilter = fieldId
    ? undefined
    : extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldLabel");

  const workspaceMappings = await getWorkspaceMappings(workspaceId);
  const loadSurvey = createSurveyLoader();

  let mappings: TMappingRef[] = [];
  if (fieldId) {
    mappings = resolveMappingsByFieldId(fieldId, workspaceMappings);
  } else if (fieldLabelFilter) {
    mappings = await resolveMappingsByFieldLabel(fieldLabelFilter, workspaceMappings, loadSurvey);
  }

  // Nothing pinned down, but the chart is grouping by the raw option id: label from the whole
  // workspace rather than leaving the ids bare.
  if (mappings.length === 0 && hasValueId) {
    mappings = workspaceMappings;
  }
  if (mappings.length === 0) {
    return { rewrittenQuery: query };
  }

  const optionLabels = await buildOptionLabels(mappings, loadSurvey);
  if (Object.keys(optionLabels).length === 0) {
    return { rewrittenQuery: query };
  }

  return { rewrittenQuery: query, optionLabels };
}
