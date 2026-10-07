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
    rawNextBlockId = survey.blocks[0]?.id || firstEndingId;
    variables = {};
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
