import { type TResponseNotShown } from "@formbricks/types/surveys/not-shown";
import { type TOptionListKey, type TOptionsNotShown } from "@formbricks/types/surveys/show-if";
import { START_BLOCK_ID } from "./survey-navigation";

/**
 * The not-shown record the survey sends with every update (ENG-6936, ADR 0023), built from what
 * `advanceFromBlock` and `enterBlock` decided along the respondent's path.
 *
 * Each submit leaves one step: the card it was submitted from, the elements that page hid by show-if,
 * and the blocks passed over on the way to the next card. The steps sit next to the renderer's
 * history, one per submitted card, so Back drops the steps of the cards it leaves: a later submit
 * replaces them with what the new path decides. The record is folded from the steps that remain, so
 * it is always the whole current one, and the server replaces the stored record with it.
 *
 * Later submits win. A block shown on the path clears what an earlier step said about it, and a block
 * passed over lists the block alone (its elements go with it), so an item that became visible again
 * after Back or a changed answer drops out of the record.
 */
export interface TNotShownStep {
  /** The card the step was submitted from: a block id, or the `"start"` sentinel of the welcome card. */
  blockId: string;
  /** Elements of that block hidden by show-if when it was submitted. */
  hiddenElementIds: string[];
  /** Blocks passed over after it because they were not shown. */
  skippedBlockIds: string[];
  /**
   * The options, rows and columns that block's shown elements did not offer (ENG-6937). Optional: a
   * step saved for offline progress before 6937 has none.
   */
  optionsNotShown?: TOptionsNotShown;
}

/** Where each option list goes in the record (json-shapes §8). */
const RECORD_KEY_OF: Record<TOptionListKey, "options" | "rows" | "columns"> = {
  choices: "options",
  rows: "rows",
  columns: "columns",
};

type TRecordSurvey = { blocks: readonly { id: string; elements: readonly { id: string }[] }[] };

/**
 * The steps after a submit from history position `historyLength`: the steps of every card still on
 * the path, then this one. Steps past it belong to cards Back left, and the new path replaces them.
 */
export const appendNotShownStep = (
  steps: readonly TNotShownStep[],
  historyLength: number,
  step: TNotShownStep
): TNotShownStep[] => [...steps.slice(0, historyLength), step];

/** What the steps add up to, unordered: blocks passed over, elements hidden, options not offered. */
interface TNotShownFold {
  blocks: Set<string>;
  elements: Set<string>;
  /** Element id → what it did not offer, from the step that last submitted its block. */
  options: Map<string, TOptionsNotShown[string]>;
}

const foldNotShownSteps = (survey: TRecordSurvey, steps: readonly TNotShownStep[]): TNotShownFold => {
  const fold: TNotShownFold = { blocks: new Set(), elements: new Set(), options: new Map() };
  /** Forgets what earlier steps said about a block's elements. */
  const forgetElementsOf = (blockId: string) => {
    const block = survey.blocks.find((item) => item.id === blockId);
    for (const element of block?.elements ?? []) {
      fold.elements.delete(element.id);
      fold.options.delete(element.id);
    }
  };

  for (const step of steps) {
    // Submitted from this block, so it was shown, and only what its page hid stays hidden.
    fold.blocks.delete(step.blockId);
    forgetElementsOf(step.blockId);
    for (const elementId of step.hiddenElementIds) fold.elements.add(elementId);
    for (const [elementId, notShown] of Object.entries(step.optionsNotShown ?? {})) {
      fold.options.set(elementId, notShown);
    }

    for (const blockId of step.skippedBlockIds) {
      fold.blocks.add(blockId);
      forgetElementsOf(blockId);
    }
  }
  return fold;
};

/** ENG-6937: per shown element, the options, rows and columns it did not offer, in survey order. */
const getOrderedOptionsNotShown = (
  survey: TRecordSurvey,
  fold: TNotShownFold
): Pick<TResponseNotShown, "options" | "rows" | "columns"> => {
  const maps: Pick<TResponseNotShown, "options" | "rows" | "columns"> = {};
  for (const element of survey.blocks.flatMap((block) => block.elements)) {
    const notShown = fold.options.get(element.id);
    if (!notShown || fold.elements.has(element.id)) continue;
    for (const [listKey, ids] of Object.entries(notShown) as [TOptionListKey, string[]][]) {
      if (ids.length === 0) continue;
      const recordKey = RECORD_KEY_OF[listKey];
      maps[recordKey] = { ...maps[recordKey], [element.id]: ids };
    }
  }
  return maps;
};

/** The record the steps add up to, in survey order. `{}` when nothing was kept from the respondent. */
export const buildNotShownRecord = (
  survey: TRecordSurvey,
  steps: readonly TNotShownStep[]
): TResponseNotShown => {
  const fold = foldNotShownSteps(survey, steps);

  const orderedBlocks = survey.blocks.filter((block) => fold.blocks.has(block.id)).map((block) => block.id);
  const orderedElements = survey.blocks.flatMap((block) =>
    block.elements.filter((element) => fold.elements.has(element.id)).map((element) => element.id)
  );

  return {
    ...(orderedBlocks.length > 0 && { blocks: orderedBlocks }),
    ...(orderedElements.length > 0 && { elements: orderedElements }),
    ...getOrderedOptionsNotShown(survey, fold),
  };
};

/**
 * The saved steps to restore with offline progress, next to `getRestorableHistory`: the steps sit one
 * per history entry, so a step submitted from a block the creator has deleted since is dropped with
 * its history entry, and the two stay aligned.
 */
export const getRestorableNotShownSteps = (
  survey: TRecordSurvey,
  steps: readonly TNotShownStep[]
): TNotShownStep[] =>
  steps.filter(
    (step) => step.blockId === START_BLOCK_ID || survey.blocks.some((block) => block.id === step.blockId)
  );

/**
 * The answers after a submit: what the page submitted on top of the earlier answers, without the
 * answers to elements the respondent was not shown (ENG-6931, ENG-6936). What the renderer keeps,
 * and what offline progress saves.
 */
export const mergeSubmittedAnswers = <TData extends Record<string, unknown>>(
  responseData: TData,
  submittedData: TData,
  notShownElementIds: Iterable<string>
): TData => {
  const next: Record<string, unknown> = { ...responseData, ...submittedData };
  for (const elementId of notShownElementIds) delete next[elementId];
  return next as TData;
};
