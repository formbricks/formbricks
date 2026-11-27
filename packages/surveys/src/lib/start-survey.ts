import { buildEmbeddedLookup } from "@formbricks/types/embedded-data-resolver";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import type { TPreselections } from "@formbricks/types/surveys/preselect-answer";
import { evaluateLogic, performActions } from "@/lib/logic";
import { END_BLOCK_ID, START_BLOCK_ID } from "@/lib/survey-navigation";

/**
 * How the survey starts, split out of `block-flow.ts` (which decides every move after it): the rules
 * before the first question, and the first card they lead to.
 */

export interface TStartSurveyInput {
  survey: TJsWorkspaceStateSurvey;
  /** The block a start-at link opens on, already resolved from its question id. */
  startAtBlockId?: string;
  /** What the survey loaded with: the hidden fields and URL parameters, after the ingest contract. */
  responseData: TResponseData;
  /** The computed fields, seeded with their defaults. */
  variables: TResponseVariables;
  selectedLanguage: string;
  reservedFieldValues: Record<string, string | number>;
}

export interface TStartSurveyResult {
  /**
   * The first card the respondent sees: the ending of a screen-out, else the welcome card
   * (`"start"`), else the block a rule jumped to, the start-at block or the first block.
   */
  firstCardId: string;
  /** The block a rule jumped to, which the welcome card leads to; `undefined` without a jump. */
  startBlockId: string | undefined;
  /** True for a screen-out: the survey is over before it begins. */
  finished: boolean;
  /** The ending of a screen-out, for the response the survey creates at once. */
  endingId: string | undefined;
  variables: TResponseVariables;
  /**
   * A rule marked the response Low quality (ENG-6952). The caller sends `markLowQuality: true` with
   * the response's first write: the first page's, or the finished response of a screen-out.
   */
  markLowQuality: boolean;
  /** Answers the rules pre-selected (ENG-7437), by question id; see `TAdvanceFromBlockResult`. */
  preselections: TPreselections;
}

/**
 * How the survey starts (ENG-6932, P8): the rules before the first question (`survey.startLogic`)
 * run as soon as the survey loads, before the welcome card, and on start-at links too, so a
 * screener holds whichever way the respondent arrives.
 *
 * They are evaluated like block logic: the first rule that jumps wins and every matching rule's
 * calculations run. They read hidden fields, computed fields and reserved fields; there are no
 * answers yet. A jump to an ending is a screen-out: the respondent sees only that ending. A jump to
 * a block wins over a start-at link, and the welcome card (when there is one and no start-at link)
 * still shows first and leads there. Without a jump the survey starts exactly as it always did.
 * A rule may also mark the response Low quality (ENG-6952), say for a known-bad panel source: the
 * respondent carries on, or is screened out, as the rules decide, and sees nothing of the mark.
 */
export const startSurvey = (input: TStartSurveyInput): TStartSurveyResult => {
  const { survey, responseData, selectedLanguage, reservedFieldValues, startAtBlockId } = input;
  const embeddedValues = buildEmbeddedLookup(survey, reservedFieldValues, responseData);

  let variables = { ...input.variables };
  let jumpTarget: string | undefined;
  let markLowQuality = false;
  let preselections: TPreselections = {};

  for (const rule of survey.startLogic ?? []) {
    if (!evaluateLogic(survey, responseData, variables, rule.conditions, selectedLanguage, embeddedValues)) {
      continue;
    }
    // ENG-6935: a Set value step here reads the same language and reserved values as after a block.
    const actions = performActions(survey, rule.actions, responseData, variables, {
      selectedLanguage,
      embeddedValues,
    });
    if (actions.jumpTarget && !jumpTarget) jumpTarget = actions.jumpTarget;
    variables = { ...variables, ...actions.calculations };
    markLowQuality ||= actions.markLowQuality;
    preselections = { ...preselections, ...actions.preselections };
  }

  // A stale target (a deleted block or ending) counts as no jump, as it does after a block.
  const endingId = survey.endings.find((ending) => ending.id === jumpTarget)?.id;
  if (endingId) {
    return {
      firstCardId: endingId,
      startBlockId: undefined,
      finished: true,
      endingId,
      variables,
      markLowQuality,
      preselections,
    };
  }
  const startBlockId = survey.blocks.find((block) => block.id === jumpTarget)?.id;

  let firstCardId: string;
  if (startBlockId) {
    firstCardId = survey.welcomeCard.enabled && !startAtBlockId ? START_BLOCK_ID : startBlockId;
  } else if (startAtBlockId) {
    firstCardId = startAtBlockId;
  } else if (survey.welcomeCard.enabled) {
    firstCardId = START_BLOCK_ID;
  } else {
    firstCardId = survey.blocks[0]?.id ?? survey.endings[0]?.id ?? END_BLOCK_ID;
  }

  return {
    firstCardId,
    startBlockId,
    finished: false,
    endingId: undefined,
    variables,
    markLowQuality,
    preselections,
  };
};
