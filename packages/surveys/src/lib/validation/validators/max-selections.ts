import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsMaxSelections } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";
import { countSelections } from "./selection-utils";

export const maxSelectionsValidator: TValidator<TValidationRuleParamsMaxSelections> = {
    check: (value: TResponseDataValue, params: TValidationRuleParamsMaxSelections, _element: TSurveyElement): TValidatorCheckResult => {
        // If value is not an array, rule doesn't apply (graceful)
        if (!Array.isArray(value)) {
            return { valid: true };
        }

        const selectionCount = countSelections(value);
        return { valid: selectionCount <= params.max };
    },

    getDefaultMessage: (params: TValidationRuleParamsMaxSelections, t: TFunction): string => {
        return t("errors.max_selections", { max: params.max });
    },
};


