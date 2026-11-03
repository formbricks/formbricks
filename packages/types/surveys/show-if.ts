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

/** Per option list, the ids an element does not offer (ENG-6937). Lists with none are left out. */
export type TElementOptionsNotShown = Partial<Record<TOptionListKey, string[]>>;

/** Element id → the options, rows and columns it does not offer. Elements with none are left out. */
export type TOptionsNotShown = Record<string, TElementOptionsNotShown>;

export interface TBlockVisibility<TData> {
  /** Whether the block is shown as a page. */
  shown: boolean;
  skipReason?: TBlockSkipReason;
  /** The elements the page shows, in block order. Empty when the block's own show-if failed. */
  visibleElementIds: string[];
  /**
   * The elements not shown, in block order: hidden by their show-if, or left with no options to offer
   * (ENG-6937). Not evaluated (empty) when the block's own show-if failed: then the whole block is not
   * shown.
   */
  hiddenElementIds: string[];
  /**
   * For the visible elements only, the options, rows and columns they don't offer: Hidden, or their
   * show-if failed (ENG-6937). An element not shown takes its options with it, so it isn't listed.
   */
  optionsNotShown: TOptionsNotShown;
  /**
   * The answers the page's conditions read: `data` without the answers of hidden elements, and
   * without options the page no longer offers (when the caller passes `dropOptionAnswers`).
   */
  data: TData;
}

const withoutKeys = <TData extends Record<string, unknown>>(data: TData, keys: string[]): TData => {
  if (!keys.some((key) => key in data)) return data;
  const copy = { ...data };
  for (const key of keys) delete copy[key];
  return copy;
};

/**
 * The options, rows and columns an element does not offer: a Hidden item never (it wins over its
 * show-if, json-shapes §2), an item whose show-if fails not now. `evaluate` reads the answers the
 * element's own show-if reads.
 */
export const getElementOptionsNotShown = (
  element: { type: string },
  evaluate: (group: TConditionGroup) => boolean
): TElementOptionsNotShown => {
  const notShown: TElementOptionsNotShown = {};
  for (const { listKey, items } of getOptionLists(element)) {
    const ids = items
      .filter((item) => item.hidden === true || !isShownByShowIf(item, evaluate))
      .map((item) => item.id);
    if (ids.length > 0) notShown[listKey] = ids;
  }
  return notShown;
};

/**
 * Whether filtering left the element nothing to offer (P2): every choice gone, or every matrix row or
 * every matrix column gone. Such a question is skipped like one hidden by its show-if.
 */
const hasNoOptionsLeft = (element: { type: string }, notShown: TElementOptionsNotShown): boolean =>
  getOptionLists(element).some(
    ({ listKey, items }) => items.length > 0 && (notShown[listKey]?.length ?? 0) === items.length
  );

/** The element as the page offers it: its option lists without the items it doesn't offer. */
export const withOptionsShown = <TElement extends { type: string }>(
  element: TElement,
  notShown: TElementOptionsNotShown | undefined
): TElement => {
  if (!notShown || Object.keys(notShown).length === 0) return element;
  const copy: Record<string, unknown> = { ...element };
  for (const { listKey, items } of getOptionLists(element)) {
    const ids = notShown[listKey];
    if (ids) copy[listKey] = items.filter((item) => !ids.includes(item.id));
  }
  return copy as TElement;
};

/**
 * Removes from `data` the parts of an element's answer that pick options it no longer offers. How an
 * answer names an option depends on the element type and the respondent's language, so the engine
 * that reads answers supplies it.
 */
export type TDropOptionAnswers<TData> = (
  element: { id: string; type: string },
  notShown: TElementOptionsNotShown,
  data: TData
) => TData;

/**
 * What a block shows for the answers in `data`.
 *
 * - The block's show-if is checked first; when it fails, the block is skipped as a whole.
 * - Then each element top to bottom. An element hidden by its show-if reads as unanswered for the
 *   elements below it (P5): its answer is dropped from the data they see, so a chain of follow-ups
 *   collapses together when the answer at its top changes.
 * - Each shown element's options, rows and columns are filtered the same way (ENG-6937), reading what
 *   the element's show-if reads. An element left with nothing to offer is skipped like a hidden one;
 *   otherwise, with `dropOptionAnswers`, the elements below read its answer without the options it
 *   no longer offers.
 * - A block left with no visible element is skipped too.
 *
 * `evaluate` resolves a condition group against the answers it receives.
 */
export const getBlockVisibility = <TData extends Record<string, unknown>>(
  block: TShowIfItem & { elements: (TShowIfItem & { id: string; type?: string })[] },
  data: TData,
  evaluate: (group: TConditionGroup, data: TData) => boolean,
  dropOptionAnswers?: TDropOptionAnswers<TData>
): TBlockVisibility<TData> => {
  if (!isShownByShowIf(block, (group) => evaluate(group, data))) {
    return {
      shown: false,
      skipReason: "showIf",
      visibleElementIds: [],
      hiddenElementIds: [],
      optionsNotShown: {},
      data,
    };
  }

  let pageData = data;
  const visibleElementIds: string[] = [];
  const hiddenElementIds: string[] = [];
  const optionsNotShown: TOptionsNotShown = {};

  for (const element of block.elements) {
    const readsData = pageData;
    const isShown = isShownByShowIf(element, (group) => evaluate(group, readsData));
    const typed = { ...element, type: element.type ?? "" };
    const notShown = isShown ? getElementOptionsNotShown(typed, (group) => evaluate(group, readsData)) : {};

    if (!isShown || hasNoOptionsLeft(typed, notShown)) {
      hiddenElementIds.push(element.id);
      pageData = withoutKeys(pageData, [element.id]);
      continue;
    }

    visibleElementIds.push(element.id);
    if (Object.keys(notShown).length > 0) {
      optionsNotShown[element.id] = notShown;
      if (dropOptionAnswers) pageData = dropOptionAnswers(typed, notShown, pageData);
    }
  }

  const shown = visibleElementIds.length > 0;
  return {
    shown,
    ...(shown ? {} : { skipReason: "allElementsHidden" as const }),
    visibleElementIds,
    hiddenElementIds,
    optionsNotShown,
    data: pageData,
  };
};

/** `data` without the answers of `elementIds`. Returns `data` itself when there is nothing to drop. */
export const dropAnswers = withoutKeys;
