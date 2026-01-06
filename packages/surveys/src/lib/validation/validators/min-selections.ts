import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsMinSelections } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";
import { countSelections } from "./selection-utils";

export const minSelectionsValidator: TValidator<TValidationRuleParamsMinSelections> = {
  check: (value: TResponseDataValue, params: TValidationRuleParamsMinSelections, _element: TSurveyElement): TValidatorCheckResult => {
    // If value is not an array, check fails (need selections)
    if (!Array.isArray(value)) {
      return { valid: false };
    }

    const selectionCount = countSelections(value);
    return { valid: selectionCount >= params.min };
  },

  getDefaultMessage: (params: TValidationRuleParamsMinSelections, t: TFunction): string => {
    return t("errors.min_selections", { min: params.min });
  },
};


