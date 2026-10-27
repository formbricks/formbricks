import type { TFunction } from "i18next";

/**
 * Why a copied or duplicated survey has no custom CSS although its source had some (ENG-2949): the
 * destination's plan cannot take it, or the CSS no longer passes the current processor. `null` when the
 * copy carries its CSS, or the source had none.
 */
export const getCustomCssCopyNotice = (copyResult: unknown, t: TFunction): string | null => {
  const notice = (copyResult as { customCssNotice?: unknown } | null | undefined)?.customCssNotice;
  if (notice === "plan_required") return t("workspace.surveys.custom_css_not_copied_plan");
  if (notice === "invalid_css") return t("workspace.surveys.custom_css_not_copied_invalid");
  return null;
};
