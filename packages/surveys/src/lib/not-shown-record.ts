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

/** The record the steps add up to, in survey order. `{}` when nothing was kept from the respondent. */
export const buildNotShownRecord = (
  survey: TRecordSurvey,
  steps: readonly TNotShownStep[]
): TResponseNotShown => {
  const blocks = new Set<string>();
  const elements = new Set<string>();
  // Element id → what it did not offer, from the step that last submitted its block.
  const options = new Map<string, TOptionsNotShown[string]>();
  const elementIdsOf = (blockId: string) =>
    survey.blocks.find((block) => block.id === blockId)?.elements.map((element) => element.id) ?? [];

  for (const step of steps) {
    // Submitted from this block, so it was shown, and only what its page hid stays hidden.
    blocks.delete(step.blockId);
    for (const elementId of elementIdsOf(step.blockId)) {
      elements.delete(elementId);
      options.delete(elementId);
    }
    for (const elementId of step.hiddenElementIds) elements.add(elementId);
    for (const [elementId, notShown] of Object.entries(step.optionsNotShown ?? {})) {
      options.set(elementId, notShown);
    }

    for (const blockId of step.skippedBlockIds) {
      blocks.add(blockId);
      for (const elementId of elementIdsOf(blockId)) {
        elements.delete(elementId);
        options.delete(elementId);
      }
    }
  }

  const orderedBlocks = survey.blocks.filter((block) => blocks.has(block.id)).map((block) => block.id);
  const orderedElements = survey.blocks.flatMap((block) =>
    block.elements.filter((element) => elements.has(element.id)).map((element) => element.id)
  );

  // ENG-6937: per shown element, the options, rows and columns it did not offer, in survey order.
  const maps: Pick<TResponseNotShown, "options" | "rows" | "columns"> = {};
  for (const block of survey.blocks) {
    for (const element of block.elements) {
      const notShown = options.get(element.id);
      if (!notShown || elements.has(element.id)) continue;
      for (const [listKey, ids] of Object.entries(notShown) as [TOptionListKey, string[]][]) {
        if (ids.length === 0) continue;
        const recordKey = RECORD_KEY_OF[listKey];
        maps[recordKey] = { ...maps[recordKey], [element.id]: ids };
      }
    }
  }

  return {
    ...(orderedBlocks.length > 0 && { blocks: orderedBlocks }),
    ...(orderedElements.length > 0 && { elements: orderedElements }),
    ...maps,
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
