import { applyIngestContract } from "@formbricks/types/embedded-data-ingest";
import {
  RESERVED_FIELD_CATALOG,
  type TClientEmbeddedValueResponse,
  buildEmbeddedLookup,
  coerceToEmbeddedDataType,
  dropShadowedReservedEntries,
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
  getSurveyEmbeddedFields,
  listShadowingNames,
  projectClientReservedValues,
} from "@formbricks/types/embedded-data-resolver";
import type { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import type { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { evaluateLogic, isConditionGroup, performActions } from "@/lib/surveyLogic/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/**
 * Why the editor preview opened on an ending (ENG-6969 T13 ①): the rule before the first question
 * that screened the preview out with the current Test values, so the preview can name it instead of
 * looking broken.
 *
 * The survey bundle (`packages/surveys`, also shipped to websites) does not report which rule fired,
 * and this editor nicety doesn't change it. The editor works the answer out itself, the way
 * `startSurvey` in `packages/surveys/src/lib/block-flow.ts` does: the same ingest contract on the
 * test values, the same seeded computed fields and reserved values, and the rules evaluated with the
 * app's own `evaluateLogic` / `performActions` (the evaluator quotas use), not a copy of them.
 *
 * Only the start logic is covered. An ending reached later in the survey, by a block's rule or its
 * fallback, depends on the answers typed in the preview and is not explained here.
 */

export interface TStartScreenOut {
  /** The rule whose jump ended the preview: the first matching rule that jumps (P8, P33). */
  rule: TSurveyBlockLogic;
  /** The ending it jumped to. */
  endingId: string;
}

export interface TFindStartScreenOutInput {
  survey: TJsWorkspaceStateSurvey;
  /** The test values as the preview hands them to the renderer (`hiddenFieldsRecord`). */
  hiddenFieldsRecord: Record<string, string>;
  /** The language the preview runs in, `"default"` for the survey's default language. */
  languageCode: string;
  /**
   * The page context a reserved field such as `url` reads. The preview runs inside the editor, so
   * the renderer reads the editor's page; the caller passes what it knows of it.
   */
  meta?: TClientEmbeddedValueResponse["meta"];
}

/** The computed fields seeded from their definitions, as the renderer seeds them before start logic. */
const seedComputedVariables = (survey: TJsWorkspaceStateSurvey): TResponseVariables =>
  getComputedEmbeddedFields(survey).reduce<TResponseVariables>((acc, { field, link }) => {
    const seed = coerceToEmbeddedDataType(field.defaultValue, field.dataType);
    if (typeof seed === "string" || typeof seed === "number") acc[link.storageKey] = seed;
    return acc;
  }, {});

/** The test values after the ingest contract: what the renderer's start logic reads as answers. */
const ingestTestValues = (
  survey: TJsWorkspaceStateSurvey,
  hiddenFieldsRecord: Record<string, string>,
  elementIds: readonly string[]
): TResponseData => {
  const { data } = applyIngestContract({
    incoming: hiddenFieldsRecord,
    ingestedFields: getIngestedEmbeddedFields(survey),
    elementIds,
    enforceSizeLimit: false,
  });
  // A key naming a question is not an answer here; the renderer drops it too.
  const elementIdSet = new Set(elementIds);
  return Object.fromEntries(Object.entries(data).filter(([key]) => !elementIdSet.has(key)));
};

/**
 * The start rule that ends the preview before the first question, or `null` when the preview
 * reaches the welcome card or a question. Like `startSurvey`: every rule runs in order (a Set value
 * step feeds the rules after it), the first jump wins, and only a jump to an existing ending is a
 * screen-out. A jump to a block, or to something deleted, is not.
 */
export const findStartScreenOut = ({
  survey,
  hiddenFieldsRecord,
  languageCode,
  meta = {},
}: TFindStartScreenOutInput): TStartScreenOut | null => {
  const rules = survey.startLogic ?? [];
  if (rules.length === 0) return null;

  const elementIds = getElementsFromBlocks(survey.blocks).map((element) => element.id);
  const responseData = ingestTestValues(survey, hiddenFieldsRecord, elementIds);
  let variables = seedComputedVariables(survey);
  const defaultLanguageCode = survey.languages.find((language) => language.default)?.language.code;
  const reservedFieldValues = projectClientReservedValues(
    dropShadowedReservedEntries(
      RESERVED_FIELD_CATALOG,
      listShadowingNames(getSurveyEmbeddedFields(survey), elementIds)
    ),
    {
      surveyId: survey.id,
      language: languageCode === "default" ? (defaultLanguageCode ?? null) : languageCode,
      data: responseData,
      variables,
      ttc: {},
      meta,
    }
  );
  const embeddedValues = buildEmbeddedLookup(survey, reservedFieldValues, responseData);

  let jump: { rule: TSurveyBlockLogic; target: string } | undefined;
  for (const rule of rules) {
    if (!evaluateLogic(survey, responseData, variables, rule.conditions, languageCode, embeddedValues)) {
      continue;
    }
    const actions = performActions(survey, rule.actions, responseData, variables, {
      selectedLanguage: languageCode,
      embeddedValues,
    });
    if (actions.jumpTarget && !jump) jump = { rule, target: actions.jumpTarget };
    variables = { ...variables, ...actions.calculations };
  }

  if (!jump) return null;
  const ending = survey.endings.find((item) => item.id === jump.target);
  return ending ? { rule: jump.rule, endingId: ending.id } : null;
};

/** The hidden fields and URL parameters a condition group reads, by key, in order. */
const getReadFieldKeys = (group: TConditionGroup): string[] =>
  group.conditions.flatMap((condition) => {
    if (isConditionGroup(condition)) return getReadFieldKeys(condition);
    return [condition.leftOperand, condition.rightOperand].flatMap((operand) =>
      operand?.type === "hiddenField" ? [operand.value] : []
    );
  });

/**
 * The Test values field "Set test values" focuses: the first field the rule reads that a test value
 * can be given for, or `undefined` when it reads none (the panel then opens on its first field).
 */
export const getScreenOutFieldKey = (
  rule: TSurveyBlockLogic,
  testValueKeys: readonly string[]
): string | undefined => getReadFieldKeys(rule.conditions).find((key) => testValueKeys.includes(key));
