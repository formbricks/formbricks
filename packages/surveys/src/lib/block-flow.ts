import { buildEmbeddedLookup } from "@formbricks/types/embedded-data-resolver";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TBlockVisibility, dropAnswers, getBlockVisibility } from "@formbricks/types/surveys/show-if";
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
  /**
   * The answers to persist from the current block: `submittedData` without the answers of elements
   * hidden by show-if on this page (an answer typed before the question hid is not submitted).
   */
  submittedData: TResponseData;
  /** Elements of the current block hidden by show-if when it was submitted. */
  hiddenElementIds: string[];
  /**
   * Blocks passed over on the way to `nextBlockId` because they were not shown (their show-if
   * failed, or all their elements were hidden). Their logic ran as if submitted with no answers.
   */
  skippedBlockIds: string[]; /**
   * A rule that ran on the way, on this block or a block passed over, marked the response Low
   * quality (ENG-6933). The caller sends `markLowQuality: true` with this submit's response write;
   * the respondent sees nothing.
   */
  markLowQuality: boolean;
}

type TSurveyBlock = TJsWorkspaceStateSurvey["blocks"][number];

export interface TPageVisibilityInput {
  survey: TJsWorkspaceStateSurvey;
  blockId: string;
  /** Every answer known so far, including the ones being typed on this page. */
  responseData: TResponseData;
  variables: TResponseVariables;
  selectedLanguage: string;
  reservedFieldValues: Record<string, string | number>;
}

/** What a page shows; see `getBlockVisibility`. */
export type TPageVisibility = TBlockVisibility<TResponseData>;

const getVisibility = (
  input: Omit<TPageVisibilityInput, "blockId">,
  block: TSurveyBlock
): TPageVisibility => {
  const { survey, variables, selectedLanguage, reservedFieldValues } = input;
  return getBlockVisibility(block, input.responseData, (group, data) =>
    evaluateLogic(
      survey,
      data,
      variables,
      group,
      selectedLanguage,
      buildEmbeddedLookup(survey, reservedFieldValues, data)
    )
  );
};

/**
 * What the page for `blockId` shows right now: re-evaluated by the renderer whenever an answer
 * changes, so a follow-up appears right under the answer it depends on. A `blockId` that is not a
 * block shows nothing.
 */
export const getPageVisibility = (input: TPageVisibilityInput): TPageVisibility => {
  const block = input.survey.blocks.find((candidate) => candidate.id === input.blockId);
  if (!block) {
    return { shown: false, visibleElementIds: [], hiddenElementIds: [], data: input.responseData };
  }
  return getVisibility(input, block);
};

interface TLogicOutcome {
  jumpTarget: string | undefined;
  requiredQuestionIds: string[];
  variables: TResponseVariables;
  markLowQuality: boolean;
}

const runBlockLogic = (
  input: TAdvanceFromBlockInput,
  block: TSurveyBlock,
  data: TResponseData,
  startVariables: TResponseVariables
): TLogicOutcome => {
  const { survey, selectedLanguage, reservedFieldValues } = input;
  const embeddedValues = buildEmbeddedLookup(survey, reservedFieldValues, data);

  let variables = { ...startVariables };
  let jumpTarget: string | undefined;
  const requiredQuestionIds: string[] = [];
  let markLowQuality = false;

  for (const logic of block.logic ?? []) {
    if (!evaluateLogic(survey, data, variables, logic.conditions, selectedLanguage, embeddedValues)) {
      continue;
    }

    const actions = performActions(survey, logic.actions, data, variables, {
      selectedLanguage,
      embeddedValues,
    });
    // The first rule that jumps wins, but later rules still run for their calculations and requires.
    if (actions.jumpTarget && !jumpTarget) jumpTarget = actions.jumpTarget;
    requiredQuestionIds.push(...actions.requiredQuestionIds);
    variables = { ...variables, ...actions.calculations };
    markLowQuality ||= actions.markLowQuality;
  }

  return { jumpTarget: jumpTarget || block.logicFallback, requiredQuestionIds, variables, markLowQuality };
};

interface TSkipOutcome {
  target: string | undefined;
  skippedBlockIds: string[];
  variables: TResponseVariables;
  requiredQuestionIds: string[];
  markLowQuality: boolean;
}

/**
 * From `target`, pass over every block that is not shown, running each one's logic as if it were
 * submitted with no answers (its jumps, calculations and fallback still apply). Stops at the first
 * shown block, an ending, or no target. A skipped block reached twice means skipped blocks jump in a
 * circle, which would never end: that finishes the survey instead.
 */
const skipBlocksNotShown = (
  input: TAdvanceFromBlockInput,
  target: string | undefined,
  data: TResponseData,
  startVariables: TResponseVariables
): TSkipOutcome => {
  const { survey } = input;
  const skippedBlockIds: string[] = [];
  const requiredQuestionIds: string[] = [];
  let variables = startVariables;
  let answers = data;
  let current = target;
  let markLowQuality = false;

  for (;;) {
    const blockIndex = survey.blocks.findIndex((block) => block.id === current);
    const block = survey.blocks[blockIndex];
    if (!block) break;

    if (skippedBlockIds.includes(block.id)) {
      current = undefined;
      break;
    }

    const visibility = getVisibility({ ...input, responseData: answers, variables }, block);
    if (visibility.shown) break;

    if (skippedBlockIds.length === 0) variables = { ...input.variables, ...variables };
    skippedBlockIds.push(block.id);
    // "No answers": a stale answer to this block (from before Back) must not reach its logic.
    answers = dropAnswers(
      answers,
      block.elements.map((element) => element.id)
    );
    const outcome = runBlockLogic(input, block, answers, variables);
    variables = outcome.variables;
    requiredQuestionIds.push(...outcome.requiredQuestionIds);
    markLowQuality ||= outcome.markLowQuality;
    current = outcome.jumpTarget || survey.blocks[blockIndex + 1]?.id;
  }

  return { target: current, skippedBlockIds, variables, requiredQuestionIds, markLowQuality };
};

/**
 * Turns a raw target into where the renderer goes and what the response reports. A jump target may
 * reference a deleted block or ending; such stale ids count as "no target" so the shown ending and
 * the persisted endingId stay in sync. Without a block to go to the survey is finished, on the jump
 * target's ending or else the first one.
 */
const resolveDestination = (
  survey: TJsWorkspaceStateSurvey,
  target: string | undefined
): Pick<TAdvanceFromBlockResult, "nextBlockId" | "nextCardId" | "finished" | "endingId"> => {
  const firstEndingId = survey.endings[0]?.id;
  const targetIsBlock = survey.blocks.some((block) => block.id === target);
  const targetIsEnding = survey.endings.some((ending) => ending.id === target);
  const nextBlockId = targetIsBlock || targetIsEnding ? target : undefined;
  const finished = !targetIsBlock;

  return {
    nextBlockId,
    nextCardId: nextBlockId ?? firstEndingId ?? END_BLOCK_ID,
    finished,
    endingId: finished
      ? (survey.endings.find((ending) => ending.id === nextBlockId)?.id ?? firstEndingId)
      : undefined,
  };
};

/**
 * Where the respondent goes after submitting from `blockId`.
 *
 * Owns the whole decision so the renderer only applies it: the answers the page hid by show-if
 * (dropped, ENG-6931), the block's logic rules (first jump wins, then `logicFallback`, then the next
 * block in order; any rule that runs may mark the response Low quality, ENG-6933), passing over blocks that are not shown while running their logic, the guard that
 * treats a jump target naming a deleted block or ending as "no target", and the `finished` /
 * `endingId` the persisted response reports. It reads nothing from the renderer and writes nothing, so every branch is testable
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
  let markLowQuality = false;

  let data: TResponseData = { ...input.responseData, ...input.submittedData };
  let submittedData = input.submittedData;
  let hiddenElementIds: string[] = [];

  if (blockId === START_BLOCK_ID) {
    rawNextBlockId = input.startBlockId || survey.blocks[0]?.id || firstEndingId;
    // Kept, so values set before the first question travel with the first submit (ENG-6932).
    variables = { ...input.variables };
  } else if (currentBlock) {
    // The page as it was submitted: answers to its hidden elements are neither persisted nor read by
    // its logic.
    const page = getVisibility({ ...input, responseData: data }, currentBlock);
    hiddenElementIds = page.hiddenElementIds;
    data = page.data;
    submittedData = dropAnswers(input.submittedData, hiddenElementIds);

    const outcome = runBlockLogic(input, currentBlock, data, input.variables);
    rawNextBlockId = outcome.jumpTarget || survey.blocks[currentBlockIndex + 1]?.id;
    variables = outcome.variables;
    requiredQuestionIds = outcome.requiredQuestionIds;
    markLowQuality = outcome.markLowQuality;
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

  const skipped = skipBlocksNotShown(input, rawNextBlockId, data, variables);
  rawNextBlockId = skipped.target;
  if (skipped.skippedBlockIds.length > 0) {
    variables = skipped.variables;
    requiredQuestionIds = [...requiredQuestionIds, ...skipped.requiredQuestionIds];
  }

  return {
    ...resolveDestination(survey, rawNextBlockId),
    variables,
    requiredQuestionIds,
    submittedData,
    hiddenElementIds,
    skippedBlockIds: skipped.skippedBlockIds,
    markLowQuality: markLowQuality || skipped.markLowQuality,
  };
};

/**
 * Where the respondent lands when the survey opens straight onto `blockId` (no welcome card, or a
 * start-at link): that block when it is shown, else the first shown block after it, running the
 * logic of each block passed over. The welcome card's Next goes through `advanceFromBlock`, which
 * does the same from the `"start"` sentinel.
 */
export const enterBlock = (input: Omit<TAdvanceFromBlockInput, "submittedData">): TAdvanceFromBlockResult => {
  const skipped = skipBlocksNotShown(
    { ...input, submittedData: {} },
    input.blockId,
    input.responseData,
    input.variables
  );

  return {
    ...resolveDestination(input.survey, skipped.target),
    variables: skipped.variables,
    requiredQuestionIds: skipped.requiredQuestionIds,
    submittedData: {},
    hiddenElementIds: [],
    skippedBlockIds: skipped.skippedBlockIds,
    markLowQuality: skipped.markLowQuality,
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
    // ENG-6935: a Set value step here reads the same language and reserved values as after a block.
    const actions = performActions(survey, rule.actions, responseData, variables, {
      selectedLanguage,
      embeddedValues,
    });
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
