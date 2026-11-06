import { TFunction } from "i18next";
import type { TUseKind } from "./utils";

export interface TDeletionWarning {
  title: string;
  body: string;
}

/**
 * The confirmation shown before deleting a question or block that something else uses. Title and text
 * both name the kind of use: a rule, a show-if, or another question's copied options. Literal `t()`
 * calls, so the translation scanner sees every key.
 */
export const describeDeletionWarning = (useKind: TUseKind | undefined, t: TFunction): TDeletionWarning => {
  switch (useKind) {
    case "showIf":
      return {
        title: t("workspace.surveys.edit.question_used_in_show_if_warning_title"),
        body: t("workspace.surveys.edit.question_used_in_show_if_warning_text"),
      };
    case "copiedOptions":
      return {
        title: t("workspace.surveys.edit.question_options_copied_warning_title"),
        body: t("workspace.surveys.edit.question_options_copied_warning_text"),
      };
    default:
      return {
        title: t("workspace.surveys.edit.question_used_in_logic_warning_title"),
        body: t("workspace.surveys.edit.question_used_in_logic_warning_text"),
      };
  }
};
