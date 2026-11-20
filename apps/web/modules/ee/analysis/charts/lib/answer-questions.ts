import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { cache } from "@/lib/cache";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import type { TAnswerKind, TAnswerOption, TAnswerQuestion } from "@/modules/ee/analysis/lib/answer-filter";
import type { TDatasetQuestion } from "@/modules/ee/analysis/lib/question-filter";

/**
 * The questions an answer filter may name in one Feedback Dataset (ENG-6637): the single- and
 * multi-select, NPS, rating, CSAT and CES questions of every survey mapped into it. Their kind tells
 * Cube which column holds the answer and the builder which operators to offer; their options are the
 * value keys records store (option ids, scale points).
 */

interface TMappingRef {
  surveyId: string;
  elementId: string;
  customFieldLabel: string | null;
}

interface TSurveyRef {
  id: string;
  blocks: unknown;
}

const textOf = (value: unknown, fallback: string): string =>
  value
    ? getTextContent(getLocalizedValue(value as Record<string, string>, "default")) || fallback
    : fallback;

const scale = (from: number, to: number): TAnswerOption[] =>
  Array.from({ length: to - from + 1 }, (_, index) => {
    const value = String(from + index);
    return { value, label: value };
  });

/** The kind and options of an element an answer filter can test, or `null` for any other element. */
const describeElement = (element: TSurveyElement): { kind: TAnswerKind; options: TAnswerOption[] } | null => {
  switch (element.type) {
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return {
        kind: element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ? "multi" : "choice",
        // The ids ingestion stores as value_id (transform.ts); an unmatched "other" answer is "other".
        options: (element.choices ?? []).map((choice) => ({
          value: choice.id,
          label: textOf(choice.label, choice.id),
        })),
      };
    case TSurveyElementTypeEnum.NPS:
      return { kind: "number", options: scale(0, 10) };
    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.CSAT:
    case TSurveyElementTypeEnum.CES:
      return { kind: "number", options: scale(1, element.range) };
    default:
      return null;
  }
};

/**
 * The answerable questions behind a set of mappings, one per question id, sorted by label. A question id
 * several surveys share is one question, its options merged — unless they disagree on its kind, where the
 * first survey's wins, since one rule can test only one column. Pure, so it is tested without a database.
 */
export const collectAnswerQuestions = (
  mappings: readonly TMappingRef[],
  surveys: readonly TSurveyRef[]
): TAnswerQuestion[] => {
  const surveysById = new Map(surveys.map((survey) => [survey.id, survey]));
  const byId = new Map<string, TAnswerQuestion>();

  for (const mapping of mappings) {
    const survey = surveysById.get(mapping.surveyId);
    if (!survey || !Array.isArray(survey.blocks)) continue;
    const element = getElementsFromBlocks(survey.blocks as TSurveyBlock[]).find(
      (candidate) => candidate.id === mapping.elementId
    );
    const described = element ? describeElement(element) : null;
    if (!element || !described) continue;

    const existing = byId.get(element.id);
    if (!existing) {
      byId.set(element.id, {
        id: element.id,
        label: mapping.customFieldLabel || textOf(element.headline, "Untitled"),
        ...described,
      });
      continue;
    }
    if (existing.kind !== described.kind) continue;
    const known = new Set(existing.options.map((option) => option.value));
    existing.options.push(...described.options.filter((option) => !known.has(option.value)));
  }

  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
};

/**
 * Element types whose answer is stored as one record per option or row under a composed field id
 * (`<elementId>__<optionId>`, lib/feedback-source/transform.ts), so a question filter's `fieldId equals`
 * cannot match them.
 */
const COMPOSED_FIELD_ID_TYPES: ReadonlySet<string> = new Set([
  TSurveyElementTypeEnum.MultipleChoiceMulti,
  TSurveyElementTypeEnum.Matrix,
  TSurveyElementTypeEnum.Ranking,
]);

/**
 * The questions a question filter may name (ENG-7323): every mapped element whose records carry its own
 * id as their field id, one per id, labelled as the records label it (the mapping's custom label, else the
 * default-language headline), sorted by label. Pure, so it is tested without a database.
 */
export const collectDatasetQuestions = (
  mappings: readonly TMappingRef[],
  surveys: readonly TSurveyRef[]
): TDatasetQuestion[] => {
  const surveysById = new Map(surveys.map((survey) => [survey.id, survey]));
  const byId = new Map<string, TDatasetQuestion>();

  for (const mapping of mappings) {
    if (byId.has(mapping.elementId)) continue;
    const survey = surveysById.get(mapping.surveyId);
    if (!survey || !Array.isArray(survey.blocks)) continue;
    const element = getElementsFromBlocks(survey.blocks as TSurveyBlock[]).find(
      (candidate) => candidate.id === mapping.elementId
    );
    if (!element || COMPOSED_FIELD_ID_TYPES.has(element.type)) continue;
    byId.set(element.id, {
      id: element.id,
      label: mapping.customFieldLabel || textOf(element.headline, "Untitled"),
    });
  }

  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
};

/**
 * How long one dataset's questions are reused. Every chart query with an answer rule reads them twice —
 * the validator and the Cube token — and a dashboard runs many such queries at once, so they are cached;
 * briefly, since a survey edit should reach the builder soon (C7).
 */
export const ANSWER_QUESTIONS_CACHE_TTL_MS = 60 * 1000;
/**
 * Most survey-question mappings one dataset's questions are read from. A dataset maps a handful of
 * surveys; the cap only keeps a pathological one from loading unbounded survey blocks per request.
 */
export const MAX_ANSWER_QUESTION_MAPPINGS = 1000;

/** The dataset's survey-question mappings in this workspace and the surveys they name: two queries. */
const loadMappedSurveys = async (
  workspaceId: string,
  feedbackDirectoryId: string
): Promise<{ mappings: TMappingRef[]; surveys: TSurveyRef[] }> => {
  const mappings = await prisma.feedbackSourceFormbricksMapping.findMany({
    where: { workspaceId, feedbackSource: { workspaceId, feedbackDirectoryId } },
    select: { surveyId: true, elementId: true, customFieldLabel: true },
    orderBy: [{ surveyId: "asc" }, { elementId: "asc" }],
    take: MAX_ANSWER_QUESTION_MAPPINGS,
  });
  if (mappings.length === 0) return { mappings, surveys: [] };

  const surveys = await prisma.survey.findMany({
    where: { id: { in: [...new Set(mappings.map((mapping) => mapping.surveyId))] }, workspaceId },
    select: { id: true, blocks: true },
  });

  return { mappings, surveys };
};

/** Both question lists of one dataset, from one read of its mapped surveys. */
type TDatasetSurveyQuestions = { answerQuestions: TAnswerQuestion[]; questions: TDatasetQuestion[] };

/**
 * The answerable questions and the filterable questions of one Feedback Dataset, from this workspace's
 * sources: two queries, cached per workspace and dataset for `ANSWER_QUESTIONS_CACHE_TTL_MS`. One cached
 * read feeds both lists, so the field catalog, which needs both, does not load the same surveys twice.
 */
const getDatasetSurveyQuestions = async (
  workspaceId: string,
  feedbackDirectoryId: string
): Promise<TDatasetSurveyQuestions> =>
  cache.withCache(
    async () => {
      const { mappings, surveys } = await loadMappedSurveys(workspaceId, feedbackDirectoryId);
      return {
        answerQuestions: collectAnswerQuestions(mappings, surveys),
        questions: collectDatasetQuestions(mappings, surveys),
      };
    },
    createCacheKey.custom("analytics", feedbackDirectoryId, `survey-questions-${workspaceId}`),
    ANSWER_QUESTIONS_CACHE_TTL_MS
  );

/** The answerable questions of one Feedback Dataset (see {@link getDatasetSurveyQuestions}). */
export const getAnswerQuestions = async (
  workspaceId: string,
  feedbackDirectoryId: string
): Promise<TAnswerQuestion[]> =>
  (await getDatasetSurveyQuestions(workspaceId, feedbackDirectoryId)).answerQuestions;

/**
 * The questions a question filter may name in one Feedback Dataset (ENG-7323; see
 * {@link getDatasetSurveyQuestions}). Read for the field catalog only; a query naming a question needs no
 * check against them, since an unknown id simply matches no records.
 */
export const getDatasetQuestions = async (
  workspaceId: string,
  feedbackDirectoryId: string
): Promise<TDatasetQuestion[]> =>
  (await getDatasetSurveyQuestions(workspaceId, feedbackDirectoryId)).questions;
