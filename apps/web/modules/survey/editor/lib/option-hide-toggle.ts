import type { TFunction } from "i18next";
import { type TOptionListKey, getOptionList } from "@formbricks/types/surveys/show-if";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { setOptionHidden } from "@/modules/survey/editor/lib/show-if-editing";

/**
 * The Hide quick action on an option, matrix row or matrix column in the Questions tab (ENG-6949). It
 * sets the same Hidden flag as the Flow tab's "Show options if…" popover (`setOptionHidden`), and works
 * on a live survey too: hiding is how an option is retired once it can't be deleted (P9).
 */

export interface THideToggle {
  readonly isHidden: boolean;
  /** What a click sets the flag to. */
  readonly nextHidden: boolean;
  /** The button's tooltip and accessible name. */
  readonly tooltip: string;
}

/** Literal keys per list, so the translation scan sees them. */
const getHideTooltip = (listKey: TOptionListKey, isHidden: boolean, t: TFunction): string => {
  switch (listKey) {
    case "rows":
      return isHidden
        ? t("workspace.surveys.edit.hidden_row_tooltip")
        : t("workspace.surveys.edit.hide_row_tooltip");
    case "columns":
      return isHidden
        ? t("workspace.surveys.edit.hidden_column_tooltip")
        : t("workspace.surveys.edit.hide_column_tooltip");
    default:
      return isHidden
        ? t("workspace.surveys.edit.hidden_option_tooltip")
        : t("workspace.surveys.edit.hide_option_tooltip");
  }
};

export const getHideToggle = (
  item: { hidden?: boolean },
  listKey: TOptionListKey,
  t: TFunction
): THideToggle => {
  const isHidden = item.hidden === true;
  return { isHidden, nextHidden: !isHidden, tooltip: getHideTooltip(listKey, isHidden, t) };
};

/** The toast that confirms a toggle: the item is now hidden, or shown again. */
export const getHideToggleToast = (listKey: TOptionListKey, hidden: boolean, t: TFunction): string => {
  switch (listKey) {
    case "rows":
      return hidden
        ? t("workspace.surveys.edit.row_hidden_toast")
        : t("workspace.surveys.edit.row_shown_toast");
    case "columns":
      return hidden
        ? t("workspace.surveys.edit.column_hidden_toast")
        : t("workspace.surveys.edit.column_shown_toast");
    default:
      return hidden
        ? t("workspace.surveys.edit.option_hidden_toast")
        : t("workspace.surveys.edit.option_shown_toast");
  }
};

/**
 * The survey with one item of an element's list hidden or shown again. The element is found by id
 * when the update runs, so a block or question moved meanwhile still gets the change. An element or
 * item that's gone leaves the survey as it is.
 */
export const setOptionHiddenById = (
  survey: TSurvey,
  elementId: string,
  listKey: TOptionListKey,
  optionId: string,
  hidden: boolean
): TSurvey => {
  for (const [blockIdx, block] of survey.blocks.entries()) {
    const elementIdx = block.elements.findIndex((element) => element.id === elementId);
    if (elementIdx === -1) continue;
    const items = getOptionList(block.elements[elementIdx], listKey);
    if (!items.some((item) => item.id === optionId)) return survey;
    return setOptionHidden(survey, { type: "option", blockIdx, elementIdx, listKey, optionId }, hidden);
  }
  return survey;
};
