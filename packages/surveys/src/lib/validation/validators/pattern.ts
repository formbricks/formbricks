import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsPattern } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

export const patternValidator: TValidator<TValidationRuleParamsPattern> = {
    check: (value: TResponseDataValue, params: TValidationRuleParamsPattern, _element: TSurveyElement): TValidatorCheckResult => {
        // Skip validation if value is empty (let required handle empty)
        if (!value || typeof value !== "string" || value === "") {
            return { valid: true };
        }

        try {
            const regex = new RegExp(params.pattern, params.flags);
            return { valid: regex.test(value) };
        } catch {
            // If regex is invalid, consider it valid (design-time should catch this)
            console.warn(`Invalid regex pattern: ${params.pattern}`);
            return { valid: true };
        }
    },

    getDefaultMessage: (_params: TValidationRuleParamsPattern, t: TFunction): string => {
        return t("errors.invalid_format");
    },
};


