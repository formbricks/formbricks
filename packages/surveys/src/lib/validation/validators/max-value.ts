import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsMaxValue } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

export const maxValueValidator: TValidator<TValidationRuleParamsMaxValue> = {
    check: (value: TResponseDataValue, params: TValidationRuleParamsMaxValue, _element: TSurveyElement): TValidatorCheckResult => {
        // Skip validation if value is empty (let required handle empty)
        if (value === undefined || value === null || value === "") {
            return { valid: true };
        }

        // Handle string numbers (from OpenText with inputType=number)
        const numValue = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;

        if (isNaN(numValue)) {
            return { valid: true }; // Let pattern/type validation handle non-numeric
        }

        return { valid: numValue <= params.max };
    },

    getDefaultMessage: (params: TValidationRuleParamsMaxValue, t: TFunction): string => {
        return t("errors.max_value", { max: params.max });
    },
};


