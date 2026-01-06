import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsMinLength } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

export const minLengthValidator: TValidator<TValidationRuleParamsMinLength> = {
    check: (value: TResponseDataValue, params: TValidationRuleParamsMinLength, _element: TSurveyElement): TValidatorCheckResult => {
        // Skip validation if value is not a string or is empty (let required handle empty)
        if (typeof value !== "string" || value === "") {
            return { valid: true };
        }
        return { valid: value.length >= params.min };
    },

    getDefaultMessage: (params: TValidationRuleParamsMinLength, t: TFunction): string => {
        return t("errors.min_length", { min: params.min });
    },
};


