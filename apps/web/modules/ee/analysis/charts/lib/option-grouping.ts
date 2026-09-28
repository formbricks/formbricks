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
const VALUE_TEXT_DIMENSION = "FeedbackRecords.valueText";
const FIELD_ID_DIMENSION = "FeedbackRecords.fieldId";

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
  /** Matrix row field_id → statement, in survey order. See `collectMatrixRowLabels`. */
  fieldLabels?: Record<string, string>;
  /**
   * Whether the filters pinned the maps to particular questions. A pinned map describes exactly
   * the question(s) the chart is about, so it is shipped whole — which is what lets a matrix show a
   * scale point nobody picked as 0% instead of dropping the column. An unpinned map was built from
   * the whole workspace and is pruned to the rows returned (see `pruneOptionLabels`).
   */
  pinned?: boolean;
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
 * Existing entries are never overwritten: option ids are cuids and cannot collide across elements.
 * The shared `"other"` id is the exception, and `attributable` says whether the surrounding map
 * belongs to a known question — see the parameter's own note.
 */
const collectOptionLabels = (
  element: { type: string; choices?: unknown; columns?: unknown; otherOptionPlaceholder?: unknown },
  into: Record<string, string>,
  /**
   * Whether the filters pinned this map to a particular question.
   *
   * Every choice element writes its free-text bucket under the same `"other"` id, so a map built
   * from the whole workspace holds one `"other"` entry shared by every question in it. Taking the
   * first survey's wording there — "Somewhere else" — then prints that against rows belonging to a
   * question that worded its own bucket differently. Unattributable means unlabelled-by-a-survey:
   * the generic "Other" is the only honest answer. A field-pinned map has exactly one question
   * behind it, so its explicit wording is correct and is kept.
   */
  attributable: boolean
): void => {
  const addAll = (options: unknown, skipIds?: Set<string>): void => {
    if (!Array.isArray(options)) return;
    for (const option of options as { id: string; label: TSurveyElementChoice["label"] }[]) {
      if (skipIds?.has(option.id)) continue;
      into[option.id] ??= getChoiceLabelDefault(option);
    }
  };

  if (
    element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceMulti
  ) {
    addAll(element.choices, attributable ? undefined : new Set(["other"]));

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

/**
 * Add a matrix element's row field_ids → default-language statement to `into`, in survey order.
 *
 * A matrix answer is stored as one record per row with `field_id = ${elementId}__${rowId}` and the
 * statement as `field_label` (see transform.ts). Grouping by the stable field_id keeps one row per
 * statement across languages; this map gives those ids back their text and their survey order.
 */
const collectMatrixRowLabels = (
  element: { id: string; type: string; rows?: unknown },
  into: Record<string, string>
): void => {
  if (element.type !== TSurveyElementTypeEnum.Matrix || !Array.isArray(element.rows)) return;
  for (const row of element.rows as { id: string; label: TSurveyElementChoice["label"] }[]) {
    into[`${element.id}__${row.id}`] ??= getChoiceLabelDefault(row);
  }
};

/** Resolve each mapping to its element and merge every option (and matrix row) label it can produce. */
const buildLabelMaps = async (
  mappings: TMappingRef[],
  loadSurvey: TSurveyLoader,
  attributable: boolean
): Promise<{ optionLabels: Record<string, string>; fieldLabels: Record<string, string> }> => {
  const optionLabels: Record<string, string> = {};
  const fieldLabels: Record<string, string> = {};
  for (const mapping of mappings) {
    const survey = await loadSurvey(mapping.surveyId);
    if (!survey) continue;
    const element = getElementsFromBlocks(survey.blocks).find((el) => el.id === mapping.elementId);
    if (!element) continue;
    collectOptionLabels(element, optionLabels, attributable);
    collectMatrixRowLabels(element, fieldLabels);
  }
  return { optionLabels, fieldLabels };
};

/**
 * Keep the entries of `labels` whose key appears under `dimension` in `rows`, in the map's own
 * order — the map is built in survey order (scale points left to right, statements top to bottom),
 * and that order is what the matrix chart lays its grid out by.
 */
const pruneLabelMap = (
  labels: Record<string, string>,
  rows: Record<string, unknown>[],
  dimension: string
): Record<string, string> | undefined => {
  const present = new Set(rows.map((row) => row[dimension]).filter((v) => typeof v === "string"));
  const used = Object.fromEntries(Object.entries(labels).filter(([key]) => present.has(key)));
  return Object.keys(used).length > 0 ? used : undefined;
};

/**
 * Ship only the labels a grouping actually renders. The map behind it can be built from every
 * mapping in the workspace (see below), and the caller has already narrowed the rows to the feedback
 * directory the viewer may read — so pruning against those rows keeps unrelated surveys' labels out
 * of the response and off the wire. Groupings that do not carry the map's key pass through
 * untouched; the renderer never consults the map for them.
 *
 * A `pinned` map is shipped whole: it only describes the question(s) the filters named, and the
 * matrix chart needs its unanswered scale points and statements to draw them as 0% rather than
 * leave them out. The map's order is kept either way.
 */
export const pruneOptionLabels = (
  query: TChartQuery,
  rows: Record<string, unknown>[],
  optionLabels: Record<string, string> | undefined,
  pinned = false
): Record<string, string> | undefined => {
  if (!optionLabels || pinned || !(query.dimensions ?? []).includes(VALUE_ID_DIMENSION)) {
    return optionLabels;
  }
  return pruneLabelMap(optionLabels, rows, VALUE_ID_DIMENSION);
};

/** The `fieldLabels` counterpart of {@link pruneOptionLabels}, keyed by `FeedbackRecords.fieldId`. */
export const pruneFieldLabels = (
  query: TChartQuery,
  rows: Record<string, unknown>[],
  fieldLabels: Record<string, string> | undefined,
  pinned = false
): Record<string, string> | undefined => {
  if (!fieldLabels || pinned || !(query.dimensions ?? []).includes(FIELD_ID_DIMENSION)) {
    return fieldLabels;
  }
  return pruneLabelMap(fieldLabels, rows, FIELD_ID_DIMENSION);
};

/**
 * The mappings the query's filters pin it to: a `fieldId equals` filter first, else a `fieldLabel`
 * or `fieldGroupLabel equals` filter. Empty when the filters name no question.
 */
const resolvePinnedMappings = async (
  filters: TCubeFilter[],
  workspaceMappings: TMappingRef[],
  loadSurvey: TSurveyLoader
): Promise<TMappingRef[]> => {
  const fieldId = extractMemberEqualsValue(filters, "FeedbackRecords.fieldId");
  if (fieldId) return resolveMappingsByFieldId(fieldId, workspaceMappings);

  const labelFilter =
    extractMemberEqualsValue(filters, "FeedbackRecords.fieldLabel") ??
    extractMemberEqualsValue(filters, "FeedbackRecords.fieldGroupLabel");
  return labelFilter ? resolveMappingsByFieldLabel(labelFilter, workspaceMappings, loadSurvey) : [];
};

/**
 * Both label maps of a resolved grouping, pruned to what the rows need (see `pruneOptionLabels`).
 * Spread into a query response; absent maps are left out rather than sent as undefined.
 */
export const pruneChartLabels = (
  grouping: TOptionGroupingResult,
  rows: Record<string, unknown>[]
): { optionLabels?: Record<string, string>; fieldLabels?: Record<string, string> } => {
  const { rewrittenQuery, pinned } = grouping;
  const optionLabels = pruneOptionLabels(rewrittenQuery, rows, grouping.optionLabels, pinned);
  const fieldLabels = pruneFieldLabels(rewrittenQuery, rows, grouping.fieldLabels, pinned);
  return { ...(optionLabels ? { optionLabels } : {}), ...(fieldLabels ? { fieldLabels } : {}) };
};

/**
 * When a query groups by `FeedbackRecords.valueText`, `FeedbackRecords.valueId` or
 * `FeedbackRecords.fieldId`, attach label maps so the renderer can show human-readable text instead
 * of the raw ids stored in the record:
 * - `optionLabels`: `{ [value_id]: defaultLabel }` for choice and matrix-column ids;
 * - `fieldLabels`: `{ [field_id]: statement }` for matrix rows (`${elementId}__${rowId}`).
 *
 * The dimension the user picked is never rewritten: choice records store one row per option with
 * its own value_id (see transform.ts), so valueText and valueId both group correctly on their own.
 *
 * Which mappings contribute labels:
 * - a `FeedbackRecords.fieldId equals <id>` filter pins the mapping directly (matching the
 *   `${elementId}__${optionId}` form multi-select and matrix records use as well);
 * - otherwise a `FeedbackRecords.fieldLabel equals <label>` or `FeedbackRecords.fieldGroupLabel
 *   equals <label>` filter matches every mapping whose effective label is that string — several
 *   surveys may ask the same question, and all of them contribute. A matrix's group label is its
 *   headline (or custom label), which is exactly the effective label, so the matrix chart's recipe
 *   pins its question this way;
 * - when the filters pin nothing and the chart groups by valueId or fieldId, every mapping in the
 *   workspace contributes. Grouping by valueId with no resolvable label map is exactly the case that
 *   renders bare cuids (ENG-3140), and option and element ids are cuids, so a wider map cannot
 *   mislabel a bucket — with the one exception of the shared `"other"` id, which falls back to a
 *   generic label there rather than borrowing whichever survey was read first.
 *   A valueText grouping is readable on its own and does not pay for that widening.
 *
 * `rewrittenQuery` is always the original query (kept for caller symmetry); each map is omitted
 * when no mapped element produces an entry for it.
 */
export async function resolveOptionGrouping(
  query: TChartQuery,
  workspaceId: string
): Promise<TOptionGroupingResult> {
  const dimensions = query.dimensions ?? [];
  const hasValueText = dimensions.includes(VALUE_TEXT_DIMENSION);
  const hasValueId = dimensions.includes(VALUE_ID_DIMENSION);
  const hasFieldId = dimensions.includes(FIELD_ID_DIMENSION);
  if (!hasValueText && !hasValueId && !hasFieldId) {
    return { rewrittenQuery: query };
  }

  const workspaceMappings = await getWorkspaceMappings(workspaceId);
  const loadSurvey = createSurveyLoader();

  let mappings = await resolvePinnedMappings(query.filters ?? [], workspaceMappings, loadSurvey);

  // Nothing pinned down, but the chart is grouping by a raw id: label from the whole workspace
  // rather than leaving the ids bare. The map is then not attributable to one question, which
  // decides how the shared "other" bucket is labelled (see `collectOptionLabels`).
  let attributable = true;
  if (mappings.length === 0 && (hasValueId || hasFieldId)) {
    mappings = workspaceMappings;
    attributable = false;
  }
  if (mappings.length === 0) {
    return { rewrittenQuery: query };
  }

  const maps = await buildLabelMaps(mappings, loadSurvey, attributable);
  const optionLabels =
    (hasValueId || hasValueText) && Object.keys(maps.optionLabels).length > 0 ? maps.optionLabels : undefined;
  const fieldLabels = hasFieldId && Object.keys(maps.fieldLabels).length > 0 ? maps.fieldLabels : undefined;
  if (!optionLabels && !fieldLabels) {
    return { rewrittenQuery: query };
  }

  return {
    rewrittenQuery: query,
    ...(optionLabels ? { optionLabels } : {}),
    ...(fieldLabels ? { fieldLabels } : {}),
    pinned: attributable,
  };
}
