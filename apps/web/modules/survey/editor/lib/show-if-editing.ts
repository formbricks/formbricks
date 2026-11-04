import { createId } from "@paralleldrive/cuid2";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TConditionGroup, TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import { type TOptionListKey, getOptionList } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Show-if editing on the Flow tab (ENG-6931): which answers a show-if may use, how a new one starts,
 * and how it is written back. Pure, so the popovers only render what these return.
 */

/**
 * What carries the show-if: a block, one element of a block, or one option, matrix row or matrix
 * column of an element (ENG-6937), named by id so a reorder doesn't move the edit to another option.
 */
export type TShowIfTarget =
  | { type: "block"; blockIdx: number }
  | { type: "element"; blockIdx: number; elementIdx: number }
  | { type: "option"; blockIdx: number; elementIdx: number; listKey: TOptionListKey; optionId: string };

type TOptionItem = { id: string; showIf?: TConditionGroup; hidden?: boolean };

/**
 * The survey as the target's conditions editor sees it, with `blockIdx` for the shared conditions
 * factory, which offers the elements of `blocks[0..blockIdx]`.
 *
 * The reference rule (json-shapes §1) is narrower than block logic's "this block and earlier", so the
 * survey is cut down to what the rule allows: a block's show-if sees the earlier blocks; an element's
 * show-if sees the earlier blocks plus the elements above it on its block, and so does the show-if of
 * one of its options. Fields and variables are kept, as they may be used anywhere.
 */
export const getShowIfScope = (
  survey: TSurvey,
  target: TShowIfTarget
): { survey: TSurvey; blockIdx: number } => {
  const earlierBlocks = survey.blocks.slice(0, target.blockIdx);
  const ownBlock = survey.blocks[target.blockIdx];
  const blocks =
    target.type !== "block" && ownBlock && target.elementIdx > 0
      ? [...earlierBlocks, { ...ownBlock, elements: ownBlock.elements.slice(0, target.elementIdx) }]
      : earlierBlocks;

  return { survey: { ...survey, blocks }, blockIdx: blocks.length - 1 };
};

/** A CTA without an external button records no answer, so the validator refuses it in conditions. */
const isUsableInConditions = (element: TSurveyElement): boolean =>
  element.type !== TSurveyElementTypeEnum.CTA || Boolean(element.buttonExternal);

/**
 * What a new show-if for the target starts on: the nearest question it may use (the one right above
 * it, or the last of the block before), which is what a follow-up usually depends on. With no
 * question in reach, the first hidden field. `null` when there is nothing to use.
 */
const getShowIfStart = (
  survey: TSurvey,
  target: TShowIfTarget
): { element: TSurveyElement } | { hiddenFieldId: string } | null => {
  const inScope = getShowIfScope(survey, target).survey.blocks.flatMap((block) => block.elements);
  const nearest = inScope.findLast(isUsableInConditions);
  if (nearest) return { element: nearest };
  const hiddenFieldId = survey.hiddenFields.fieldIds?.[0];
  return hiddenFieldId ? { hiddenFieldId } : null;
};

/** Whether the target can get a show-if: something before it to depend on. */
export const canAddShowIf = (survey: TSurvey, target: TShowIfTarget): boolean =>
  getShowIfStart(survey, target) !== null;

/** A new show-if for the target, with one condition on `getShowIfStart`; `null` when there is none. */
export const createShowIf = (
  survey: TSurvey,
  target: TShowIfTarget,
  getDefaultOperator: (element: TSurveyElement) => TSurveyLogicConditionsOperator
): TConditionGroup | null => {
  const start = getShowIfStart(survey, target);
  if (!start) return null;

  const condition =
    "element" in start
      ? {
          id: createId(),
          leftOperand: { type: "element" as const, value: start.element.id },
          operator: getDefaultOperator(start.element),
        }
      : {
          id: createId(),
          leftOperand: { type: "hiddenField" as const, value: start.hiddenFieldId },
          operator: "isSet" as const,
        };

  return { id: createId(), connector: "and", conditions: [condition] };
};

const getOptionItems = (
  element: TSurveyElement | undefined,
  listKey: TOptionListKey
): readonly TOptionItem[] => getOptionList<TOptionItem>(element, listKey);

/** The option a target names; `undefined` for a block or element target, or an option gone since. */
export const getTargetOption = (survey: TSurvey, target: TShowIfTarget): TOptionItem | undefined => {
  if (target.type !== "option") return undefined;
  const element = survey.blocks[target.blockIdx]?.elements[target.elementIdx];
  return getOptionItems(element, target.listKey).find((item) => item.id === target.optionId);
};

export const getShowIf = (survey: TSurvey, target: TShowIfTarget): TConditionGroup | undefined => {
  const block = survey.blocks[target.blockIdx];
  if (!block) return undefined;
  if (target.type === "block") return block.showIf;
  if (target.type === "option") return getTargetOption(survey, target)?.showIf;
  return block.elements[target.elementIdx]?.showIf;
};

const withShowIf = <T extends { showIf?: TConditionGroup }>(
  item: T,
  showIf: TConditionGroup | undefined
): T => {
  // Removed key and all, so a survey whose show-if is added and removed again compares equal to the
  // saved one (the editor's dirty check is a deep equality).
  const { showIf: _removed, ...rest } = item;
  return showIf ? ({ ...rest, showIf } as T) : (rest as T);
};

/**
 * Changes the target's show-if. A show-if left with no condition is removed: an empty group already
 * means "always shown", and the editor has no row left to add one back from.
 */
export const updateShowIf = (
  survey: TSurvey,
  target: TShowIfTarget,
  updater: (showIf: TConditionGroup) => TConditionGroup | undefined
): TSurvey => {
  const current = getShowIf(survey, target);
  const updated = current ? updater(structuredClone(current)) : updater(createEmptyGroup());
  const next = updated && updated.conditions.length > 0 ? updated : undefined;

  if (target.type === "option") return updateOption(survey, target, (option) => withShowIf(option, next));

  return {
    ...survey,
    blocks: survey.blocks.map((block, blockIdx) => {
      if (blockIdx !== target.blockIdx) return block;
      if (target.type === "block") return withShowIf(block, next);
      return {
        ...block,
        elements: block.elements.map((element, elementIdx) =>
          elementIdx === target.elementIdx ? withShowIf(element, next) : element
        ),
      };
    }),
  };
};

type TOptionTarget = Extract<TShowIfTarget, { type: "option" }>;

/** The survey with one option, row or column replaced by `update(option)`. */
const updateOption = (
  survey: TSurvey,
  target: TOptionTarget,
  update: (option: TOptionItem) => TOptionItem
): TSurvey => ({
  ...survey,
  blocks: survey.blocks.map((block, blockIdx) => {
    if (blockIdx !== target.blockIdx) return block;
    return {
      ...block,
      elements: block.elements.map((element, elementIdx) => {
        const items = elementIdx === target.elementIdx ? getOptionItems(element, target.listKey) : [];
        if (items.length === 0) return element;
        return {
          ...element,
          [target.listKey]: items.map((item) => (item.id === target.optionId ? update(item) : item)),
        } as typeof element;
      }),
    };
  }),
});

/**
 * Hides an option, matrix row or matrix column for good, or shows it again (ENG-6937). Showing it
 * again drops the key, so a survey hidden and shown again compares equal to the saved one.
 */
export const setOptionHidden = (survey: TSurvey, target: TOptionTarget, hidden: boolean): TSurvey =>
  updateOption(survey, target, (option) => {
    const { hidden: _removed, ...rest } = option;
    return hidden ? { ...rest, hidden: true } : rest;
  });

const createEmptyGroup = (): TConditionGroup => ({ id: createId(), connector: "and", conditions: [] });
