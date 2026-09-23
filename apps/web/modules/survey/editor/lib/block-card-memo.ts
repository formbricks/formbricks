import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { extractIds } from "@/lib/utils/recall";

/**
 * Decides whether a BlockCard can skip re-rendering (ENG-992).
 *
 * A card reads more than its own block: recall labels in its headlines, the operands and targets of
 * its logic rules, "move to block" menus and element numbering all come from the rest of the survey.
 * The rules below re-render a card whenever anything it displays may have changed:
 *
 * - any prop other than `localSurvey` / `activeElementId` / `invalidElements` changed identity
 *   (its own `block`, index, flags and the — stable — handlers);
 * - the active element moved into, out of, or within the block;
 * - the invalid ids that belong to the block changed, or a fresh validation pass flagged it again;
 * - the survey changed and the card is active or was the last one the user interacted with — those
 *   host editing forms and open menus that read the whole survey, so they always get fresh data;
 * - the survey changed in something other than `blocks` (languages, endings, variables, ...);
 * - the block order, block names or element ids/order changed anywhere;
 * - an element the card references changed: by id (logic operands, `requireAnswer` targets) or by
 *   recall token, followed transitively, and including elements recalled by ending cards.
 *
 * An edit to an unreferenced element in another block therefore leaves the card alone.
 */

export interface TBlockCardMemoProps {
  localSurvey: TSurvey;
  block: TSurveyBlock;
  activeElementId: string | null;
  invalidElements?: string[];
  isLastInteracted: boolean;
}

const SURVEY_DEPENDENT_PROPS = new Set<string>(["localSurvey", "activeElementId", "invalidElements"]);

const stringsCache = new WeakMap<object, ReadonlySet<string>>();

const addStrings = (value: unknown, out: Set<string>): void => {
  if (typeof value === "string") {
    out.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => addStrings(item, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => addStrings(item, out));
  }
};

/** Every string value anywhere inside `value`. Survey objects are immutable, so this is cached. */
export const getNestedStrings = (value: object): ReadonlySet<string> => {
  const cached = stringsCache.get(value);
  if (cached) return cached;
  const strings = new Set<string>();
  addStrings(value, strings);
  stringsCache.set(value, strings);
  return strings;
};

// Keyed on the `blocks` array: every card compares the same two snapshots on each render.
const blocksIndexCache = new WeakMap<
  TSurvey["blocks"],
  { elementsById: Map<string, TSurveyElement>; structureKey: string }
>();

const getBlocksIndex = (survey: TSurvey) => {
  const cached = blocksIndexCache.get(survey.blocks);
  if (cached) return cached;
  const index = {
    elementsById: new Map(
      survey.blocks.flatMap((block) => block.elements.map((element) => [element.id, element] as const))
    ),
    structureKey: JSON.stringify(
      survey.blocks.map((block) => [block.id, block.name, block.elements.map((element) => element.id)])
    ),
  };
  blocksIndexCache.set(survey.blocks, index);
  return index;
};

/** Ids of the elements that `block` (and the ending cards) display data from, followed transitively. */
export const getReferencedElementIds = (survey: TSurvey, block: TSurveyBlock): string[] => {
  const { elementsById } = getBlocksIndex(survey);
  const referenced = new Set<string>();
  const queue: object[] = [block, ...survey.endings];

  while (queue.length > 0) {
    const current = queue.pop() as object;
    for (const text of getNestedStrings(current)) {
      const candidateIds = text.includes("#recall:") ? extractIds(text) : [text];
      for (const id of candidateIds) {
        const element = elementsById.get(id);
        if (element && !referenced.has(id)) {
          referenced.add(id);
          queue.push(element);
        }
      }
    }
  }

  return [...referenced];
};

const haveSameNonBlockFields = (prev: TSurvey, next: TSurvey): boolean => {
  const prevKeys = Object.keys(prev) as (keyof TSurvey)[];
  if (prevKeys.length !== Object.keys(next).length) return false;
  return prevKeys.every((key) => key === "blocks" || Object.is(prev[key], next[key]));
};

/** True when nothing `block`'s card displays differs between the two survey snapshots. */
export const isSurveyEquivalentForBlock = (prev: TSurvey, next: TSurvey, block: TSurveyBlock): boolean => {
  if (prev === next) return true;
  if (!haveSameNonBlockFields(prev, next)) return false;
  const prevIndex = getBlocksIndex(prev);
  const nextIndex = getBlocksIndex(next);
  if (prevIndex.structureKey !== nextIndex.structureKey) return false;

  return getReferencedElementIds(next, block).every(
    (id) => prevIndex.elementsById.get(id) === nextIndex.elementsById.get(id)
  );
};

export const getActiveElementIdInBlock = (
  block: TSurveyBlock,
  activeElementId: string | null
): string | null => block.elements.find((element) => element.id === activeElementId)?.id ?? null;

/** The invalid ids that belong to the block: its own id, its elements, logic rules, or anything nested. */
export const getBlockInvalidIds = (block: TSurveyBlock, invalidElements?: string[]): string[] => {
  if (!invalidElements?.length) return [];
  const blockStrings = getNestedStrings(block);
  return invalidElements.filter((id) => blockStrings.has(id));
};

const haveSameInvalidState = <T extends TBlockCardMemoProps>(
  prev: Readonly<T>,
  next: Readonly<T>
): boolean => {
  const prevInvalid = getBlockInvalidIds(prev.block, prev.invalidElements);
  const nextInvalid = getBlockInvalidIds(next.block, next.invalidElements);
  if (prevInvalid.length !== nextInvalid.length || prevInvalid.some((id, i) => id !== nextInvalid[i])) {
    return false;
  }
  // ConditionalLogic re-expands a flagged rule on every validation pass, keyed on the array identity.
  return nextInvalid.length === 0 || prev.invalidElements === next.invalidElements;
};

/** `React.memo` comparator for BlockCard: true means the card can skip this render. */
export const areBlockCardPropsEqual = <T extends TBlockCardMemoProps>(
  prev: Readonly<T>,
  next: Readonly<T>
): boolean => {
  const nextKeys = Object.keys(next) as (keyof T & string)[];
  if (Object.keys(prev).length !== nextKeys.length) return false;
  for (const key of nextKeys) {
    if (!SURVEY_DEPENDENT_PROPS.has(key) && !Object.is(prev[key], next[key])) return false;
  }

  const nextActiveId = getActiveElementIdInBlock(next.block, next.activeElementId);
  if (getActiveElementIdInBlock(prev.block, prev.activeElementId) !== nextActiveId) return false;
  if (!haveSameInvalidState(prev, next)) return false;

  if (prev.localSurvey === next.localSurvey) return true;
  if (nextActiveId !== null || next.isLastInteracted) return false;
  return isSurveyEquivalentForBlock(prev.localSurvey, next.localSurvey, next.block);
};
