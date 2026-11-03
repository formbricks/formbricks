import type { TConditionGroup } from "./logic";

/**
 * Show-if (ENG-6931): which blocks and elements a respondent is shown.
 *
 * Written once here, next to the shared condition-group recursion in `logic-evaluation.ts` (T8), and
 * used by the survey bundle and the editor. How a single condition resolves stays with each engine:
 * the caller passes `evaluate`, which reads the answers it is given.
 *
 * Kept pure on purpose: the not-shown record (ENG-6936) and option show-if (ENG-6937) extend the
 * result instead of re-deriving it.
 */

type TShowIfItem = { showIf?: TConditionGroup };

/** Where an element keeps the items a respondent picks from (ENG-6937). */
export type TOptionListKey = "choices" | "rows" | "columns";

/** An option, a matrix row or a matrix column, as far as show-if and Hidden read it (json-shapes §2). */
export interface TOptionLike {
  id: string;
  showIf?: TConditionGroup;
  hidden?: boolean;
}

const OPTION_LISTS_BY_TYPE: Record<string, readonly TOptionListKey[]> = {
  multipleChoiceSingle: ["choices"],
  multipleChoiceMulti: ["choices"],
  ranking: ["choices"],
  pictureSelection: ["choices"],
  matrix: ["rows", "columns"],
};

/**
 * The option lists of an element that option show-if and Hidden apply to (P2): the choices of single
 * select, multi select, ranking and picture selection, and a matrix's rows and columns. Any other
 * element type has none.
 */
export const getOptionLists = (element: {
  type: string;
}): { listKey: TOptionListKey; items: readonly TOptionLike[] }[] => {
  const record = element as unknown as Record<string, unknown>;
  return (OPTION_LISTS_BY_TYPE[element.type] ?? []).flatMap((listKey) => {
    const items = record[listKey];
    return Array.isArray(items) ? [{ listKey, items: items as TOptionLike[] }] : [];
  });
};

/**
 * Whether an item's show-if lets it be shown. A missing show-if and an empty group both mean "always
 * shown" (json-shapes §1). The empty case is decided here, not by the engine: an empty `or` group
 * evaluates to false, which would hide the item for good.
 */
export const isShownByShowIf = (
  item: TShowIfItem,
  evaluate: (group: TConditionGroup) => boolean
): boolean => {
  const { showIf } = item;
  if (!showIf || showIf.conditions.length === 0) return true;
  return evaluate(showIf);
};

/** Why a block is skipped: its own show-if failed, or every element on it is hidden. */
export type TBlockSkipReason = "showIf" | "allElementsHidden";

export interface TBlockVisibility<TData> {
  /** Whether the block is shown as a page. */
  shown: boolean;
  skipReason?: TBlockSkipReason;
  /** The elements the page shows, in block order. Empty when the block's own show-if failed. */
  visibleElementIds: string[];
  /**
   * The elements hidden by their show-if, in block order. Not evaluated (empty) when the block's own
   * show-if failed: then the whole block is not shown.
   */
  hiddenElementIds: string[];
  /** The answers the page's conditions read: `data` without the answers of hidden elements. */
  data: TData;
}

const withoutKeys = <TData extends Record<string, unknown>>(data: TData, keys: string[]): TData => {
  if (!keys.some((key) => key in data)) return data;
  const copy = { ...data };
  for (const key of keys) delete copy[key];
  return copy;
};

/**
 * What a block shows for the answers in `data`.
 *
 * - The block's show-if is checked first; when it fails, the block is skipped as a whole.
 * - Then each element top to bottom. An element hidden by its show-if reads as unanswered for the
 *   elements below it (P5): its answer is dropped from the data they see, so a chain of follow-ups
 *   collapses together when the answer at its top changes.
 * - A block left with no visible element is skipped too.
 *
 * `evaluate` resolves a condition group against the answers it receives.
 */
export const getBlockVisibility = <TData extends Record<string, unknown>>(
  block: TShowIfItem & { elements: (TShowIfItem & { id: string })[] },
  data: TData,
  evaluate: (group: TConditionGroup, data: TData) => boolean
): TBlockVisibility<TData> => {
  if (!isShownByShowIf(block, (group) => evaluate(group, data))) {
    return { shown: false, skipReason: "showIf", visibleElementIds: [], hiddenElementIds: [], data };
  }

  let pageData = data;
  const visibleElementIds: string[] = [];
  const hiddenElementIds: string[] = [];

  for (const element of block.elements) {
    if (isShownByShowIf(element, (group) => evaluate(group, pageData))) {
      visibleElementIds.push(element.id);
    } else {
      hiddenElementIds.push(element.id);
      pageData = withoutKeys(pageData, [element.id]);
    }
  }

  const shown = visibleElementIds.length > 0;
  return {
    shown,
    ...(shown ? {} : { skipReason: "allElementsHidden" as const }),
    visibleElementIds,
    hiddenElementIds,
    data: pageData,
  };
};

/** `data` without the answers of `elementIds`. Returns `data` itself when there is nothing to drop. */
export const dropAnswers = withoutKeys;
