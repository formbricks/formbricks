import { buildEmbeddedLookup } from "@formbricks/types/embedded-data-resolver";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { evaluateLogic, performActions } from "@/lib/logic";
import { END_BLOCK_ID, START_BLOCK_ID, getForwardTargetFromOffBlockId } from "@/lib/survey-navigation";

export interface TAdvanceFromBlockInput {
  survey: TJsWorkspaceStateSurvey;
  /** The renderer's card pointer: the `"start"` sentinel, a block id, an ending id or `"end"`. */
  blockId: string;
  /** Answers recorded before this submit. */
  responseData: TResponseData;
  /** Answers submitted from the current block. */
  submittedData: TResponseData;
  variables: TResponseVariables;
  selectedLanguage: string;
  /**
   * Reserved-field values, so logic reads the same map recall does. Built against the in-flight
   * response data, a declared field shadows a same-named reserved entry here exactly as it does in
   * recall.
   */
  reservedFieldValues: Record<string, string | number>;
  /**
   * Where the welcome card leads: the block the rules before the first question jumped to
   * (`startSurvey`'s `startBlockId`). Only read when `blockId` is the `"start"` sentinel.
   */
  startBlockId?: string;
}

export interface TAdvanceFromBlockResult {
  /** The block or ending to show next, or `undefined` when the survey runs off its last block. */
  nextBlockId: string | undefined;
  /** What the renderer points at next: `nextBlockId`, else the first ending, else the `"end"` sentinel. */
  nextCardId: string;
  finished: boolean;
  /** The ending the persisted response reports; `undefined` while the survey is not finished. */
  endingId: string | undefined;
  variables: TResponseVariables;
  /** Elements that logic made required. The caller applies and, on Back, reverts them. */
  requiredQuestionIds: string[];
}

interface TLogicOutcome {
  jumpTarget: string | undefined;
  requiredQuestionIds: string[];
  variables: TResponseVariables;
}

const runBlockLogic = (
  input: TAdvanceFromBlockInput,
  block: TJsWorkspaceStateSurvey["blocks"][number]
): TLogicOutcome => {
  const { survey, responseData, submittedData, selectedLanguage, reservedFieldValues } = input;
  const data = { ...responseData, ...submittedData };
  const embeddedValues = buildEmbeddedLookup(survey, reservedFieldValues, data);

  let variables = { ...input.variables };
  let jumpTarget: string | undefined;
  const requiredQuestionIds: string[] = [];

  for (const logic of block.logic ?? []) {
    if (!evaluateLogic(survey, data, variables, logic.conditions, selectedLanguage, embeddedValues)) {
      continue;
    }

    const actions = performActions(survey, logic.actions, data, variables);
    // The first rule that jumps wins, but later rules still run for their calculations and requires.
    if (actions.jumpTarget && !jumpTarget) jumpTarget = actions.jumpTarget;
    requiredQuestionIds.push(...actions.requiredQuestionIds);
    variables = { ...variables, ...actions.calculations };
  }

  return { jumpTarget: jumpTarget || block.logicFallback, requiredQuestionIds, variables };
};

/**
 * Where the respondent goes after submitting from `blockId`.
 *
 * Owns the whole decision so the renderer only applies it: the block's logic rules (first jump wins,
 * then `logicFallback`, then the next block in order), the guard that treats a jump target naming a
 * deleted block or ending as "no target", and the `finished` / `endingId` the persisted response
 * reports. It reads nothing from the renderer and writes nothing, so every branch is testable
 * without mounting a survey.
 */
export const advanceFromBlock = (input: TAdvanceFromBlockInput): TAdvanceFromBlockResult => {
  const { survey, blockId } = input;
  const firstEndingId = survey.endings[0]?.id;

  const currentBlockIndex = survey.blocks.findIndex((block) => block.id === blockId);
  const currentBlock = survey.blocks[currentBlockIndex];

  let rawNextBlockId: string | undefined;
  let variables: TResponseVariables;
  let requiredQuestionIds: string[] = [];

  if (blockId === START_BLOCK_ID) {
    rawNextBlockId = input.startBlockId || survey.blocks[0]?.id || firstEndingId;
    // Kept, so values set before the first question travel with the first submit (ENG-6932).
    variables = { ...input.variables };
  } else if (currentBlock) {
    const outcome = runBlockLogic(input, currentBlock);
    rawNextBlockId = outcome.jumpTarget || survey.blocks[currentBlockIndex + 1]?.id;
    variables = outcome.variables;
    requiredQuestionIds = outcome.requiredQuestionIds;
  } else {
    // `blockId` is not a block. The caller returns early for an ending id or the "end" sentinel, so in
    // practice this is a block that no longer exists because the survey was edited after progress
    // was saved. Nothing is left to advance through, so finish rather than throw — throwing escaped as
    // an unhandled rejection, which dropped the answer in hand and left the Next button spinning
    // (ENG-2818).
    const offBlockTarget = getForwardTargetFromOffBlockId(survey, blockId);

    // An ending or the sentinel is an expected position to submit from. A `blockId` that matches
    // neither is survey drift, and the only remaining signal that it happened.
    if (!offBlockTarget && blockId !== END_BLOCK_ID) {
      console.warn(
        "Formbricks: blockId no longer resolves to a block, finishing the survey. blockId:",
        blockId,
        "available blocks:",
        survey.blocks.map((b) => b.id)
      );
    }

    rawNextBlockId = offBlockTarget;
    variables = { ...input.variables };
  }

  // A jump target may reference a deleted block or ending; treat such stale ids as "no target" so the
  // shown ending and the persisted endingId stay in sync.
  const targetIsBlock = survey.blocks.some((block) => block.id === rawNextBlockId);
  const targetIsEnding = survey.endings.some((ending) => ending.id === rawNextBlockId);
  const nextBlockId = targetIsBlock || targetIsEnding ? rawNextBlockId : undefined;
  const finished = !targetIsBlock;

  // The ending that will be shown: an explicit jump target, or the first ending when the survey falls
  // off the last block.
  const endingId = finished
    ? (survey.endings.find((ending) => ending.id === nextBlockId)?.id ?? firstEndingId)
    : undefined;

  return {
    nextBlockId,
    nextCardId: nextBlockId ?? firstEndingId ?? END_BLOCK_ID,
    finished,
    endingId,
    variables,
    requiredQuestionIds,
  };
};

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
 */
export const startSurvey = (input: TStartSurveyInput): TStartSurveyResult => {
  const { survey, responseData, selectedLanguage, reservedFieldValues, startAtBlockId } = input;
  const embeddedValues = buildEmbeddedLookup(survey, reservedFieldValues, responseData);

  let variables = { ...input.variables };
  let jumpTarget: string | undefined;

  for (const rule of survey.startLogic ?? []) {
    if (!evaluateLogic(survey, responseData, variables, rule.conditions, selectedLanguage, embeddedValues)) {
      continue;
    }
    const actions = performActions(survey, rule.actions, responseData, variables);
    if (actions.jumpTarget && !jumpTarget) jumpTarget = actions.jumpTarget;
    variables = { ...variables, ...actions.calculations };
  }

  // A stale target (a deleted block or ending) counts as no jump, as it does after a block.
  const endingId = survey.endings.find((ending) => ending.id === jumpTarget)?.id;
  if (endingId) {
    return { firstCardId: endingId, startBlockId: undefined, finished: true, endingId, variables };
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

  return { firstCardId, startBlockId, finished: false, endingId: undefined, variables };
};
