import "server-only";
import { type TChartQuery, type TCubeFilter, type TMemberFilter } from "@formbricks/types/analysis";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElementChoice } from "@formbricks/types/surveys/elements";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getFeedbackSourcesWithMappings } from "@/lib/feedback-source/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";

// ── Single-select option-id resolution helpers ────────────────────────────────

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

interface TResolvedElement {
  elementId: string;
  surveyId: string;
}

export interface TOptionGroupingResult {
  rewrittenQuery: TChartQuery;
  optionLabels?: Record<string, string>;
}

/** Find the mapping that owns this elementId and return its element/survey pair. */
const resolveElementByFieldId = async (
  fieldId: string,
  workspaceId: string
): Promise<TResolvedElement | undefined> => {
  const feedbackSources = await getFeedbackSourcesWithMappings(workspaceId);
  for (const source of feedbackSources) {
    const mapping = source.formbricksMappings.find((m) => m.elementId === fieldId);
    if (mapping) {
      return { elementId: fieldId, surveyId: mapping.surveyId };
    }
  }
  return undefined;
};

/**
 * A mapping's effective label is customFieldLabel if set, otherwise the element's
 * default-language headline (mirroring how transform.ts computes field_label on ingest).
 */
const getMappingEffectiveLabel = async (
  mapping: { elementId: string; surveyId: string; customFieldLabel?: string | null },
  loadSurvey: (surveyId: string) => Promise<Awaited<ReturnType<typeof getSurvey>> | undefined>
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
 * Users filter by "Question" (fieldLabel) rather than the internal fieldId, so we resolve the
 * label → elementId by matching each mapping's effective label. If zero or multiple mappings
 * share the same label (ambiguous), returns undefined rather than guessing.
 */
const resolveElementByFieldLabel = async (
  fieldLabelFilter: string,
  workspaceId: string
): Promise<TResolvedElement | undefined> => {
  const feedbackSources = await getFeedbackSourcesWithMappings(workspaceId);

  // Dedupe survey loads so we only call getSurvey once per distinct surveyId.
  const surveyCache = new Map<string, Awaited<ReturnType<typeof getSurvey>>>();
  const loadSurvey = async (surveyId: string) => {
    if (!surveyCache.has(surveyId)) {
      surveyCache.set(surveyId, await getSurvey(surveyId));
    }
    return surveyCache.get(surveyId);
  };

  // Collect candidates: mappings whose effective label exactly matches the filter value.
  const candidates: TResolvedElement[] = [];
  for (const source of feedbackSources) {
    for (const mapping of source.formbricksMappings) {
      const effectiveLabel = await getMappingEffectiveLabel(mapping, loadSurvey);
      if (effectiveLabel === fieldLabelFilter) {
        candidates.push({ elementId: mapping.elementId, surveyId: mapping.surveyId });
      }
    }
  }

  // Ambiguity guard: if zero or multiple mappings share this label, do not guess.
  return candidates.length === 1 ? candidates[0] : undefined;
};

/**
 * Choice questions (single- AND multi-select) store one record per selected option with a stable
 * value_id (see transform.ts), so both are handled identically: respect the dimension the user
 * picked — grouping by Value (Text) stays valueText, grouping by Value (Option) stays valueId — and
 * only build the choice-id → default-language label map so the renderer can show human labels when
 * the user groups by valueId (the map is harmlessly unused otherwise). No dimension is rewritten.
 */
const buildChoiceLabels = (element: {
  choices: { id: string; label: TSurveyElementChoice["label"] }[];
}): Record<string, string> => {
  const optionLabels: Record<string, string> = {};
  for (const choice of element.choices) {
    optionLabels[choice.id] = getChoiceLabelDefault(choice);
  }
  return optionLabels;
};

/**
 * When a query groups by either `FeedbackRecords.valueText` or `FeedbackRecords.valueId`, and a
 * `FeedbackRecords.fieldId equals <id>` or `FeedbackRecords.fieldLabel equals <label>` filter is
 * present, resolve the element and — for a single- or multi-select choice question — attach a
 * `{ [value_id]: defaultLabel }` map so the renderer can show human-readable option labels when
 * the user groups by valueId. The dimension the user picked is never rewritten: both select types
 * store one record per option with its own value_id (see transform.ts), so valueText and valueId
 * both group correctly on their own.
 *
 * If no `fieldId` filter is present, falls back to a `FeedbackRecords.fieldLabel equals <label>`
 * filter: loads all source mappings, computes each mapping's effective label
 * (customFieldLabel if set, else the element's default-language headline — same logic as
 * transform.ts), and resolves exactly one match. If zero or multiple mappings share the same
 * label (ambiguous), the query is returned unchanged rather than guessing.
 *
 * Returns `{ rewrittenQuery, optionLabels }`. `rewrittenQuery` is always the original query
 * (kept for caller symmetry); `optionLabels` is set only for resolved choice questions.
 */
export async function resolveOptionGrouping(
  query: TChartQuery,
  workspaceId: string
): Promise<TOptionGroupingResult> {
  const dimensions = query.dimensions ?? [];
  const hasValueText = dimensions.includes("FeedbackRecords.valueText");
  const hasValueId = dimensions.includes("FeedbackRecords.valueId");
  if (!hasValueText && !hasValueId) {
    return { rewrittenQuery: query };
  }

  // ── Resolve element via fieldId (preferred) or fieldLabel (fallback) ──────
  const fieldId = extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldId");
  const fieldLabelFilter = fieldId
    ? undefined
    : extractMemberEqualsValue(query.filters ?? [], "FeedbackRecords.fieldLabel");

  let resolved: TResolvedElement | undefined;
  if (fieldId) {
    resolved = await resolveElementByFieldId(fieldId, workspaceId);
  } else if (fieldLabelFilter) {
    resolved = await resolveElementByFieldLabel(fieldLabelFilter, workspaceId);
  }
  if (!resolved) {
    return { rewrittenQuery: query };
  }
  const { elementId, surveyId } = resolved;

  const survey = await getSurvey(surveyId);
  if (!survey) {
    return { rewrittenQuery: query };
  }

  const elements = getElementsFromBlocks(survey.blocks);
  const element = elements.find((el) => el.id === elementId);
  if (!element) {
    return { rewrittenQuery: query };
  }

  if (
    element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceMulti
  ) {
    // Keep the user's chosen dimension; just attach labels so a valueId grouping reads nicely.
    const optionLabels = buildChoiceLabels(
      element as { choices: { id: string; label: TSurveyElementChoice["label"] }[] }
    );
    return { rewrittenQuery: query, optionLabels };
  }

  return { rewrittenQuery: query };
}
