import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsMaxLength } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

export const maxLengthValidator: TValidator<TValidationRuleParamsMaxLength> = {
    check: (value: TResponseDataValue, params: TValidationRuleParamsMaxLength, _element: TSurveyElement): TValidatorCheckResult => {
        // Skip validation if value is not a string
        if (typeof value !== "string") {
            return { valid: true };
        }
        return { valid: value.length <= params.max };
    },

    getDefaultMessage: (params: TValidationRuleParamsMaxLength, t: TFunction): string => {
        return t("errors.max_length", { max: params.max });
    },
};


