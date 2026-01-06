import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsPhone } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

// Phone regex: must start with digit or +, end with digit
// Allows digits, +, -, and spaces in between
const PHONE_REGEX = /^[0-9+][0-9+\- ]*[0-9]$/;

export const phoneValidator: TValidator<TValidationRuleParamsPhone> = {
    check: (value: TResponseDataValue, _params: TValidationRuleParamsPhone, _element: TSurveyElement): TValidatorCheckResult => {
        // Skip validation if value is empty (let required handle empty)
        if (!value || typeof value !== "string" || value === "") {
            return { valid: true };
        }
        return { valid: PHONE_REGEX.test(value) };
    },

    getDefaultMessage: (_params: TValidationRuleParamsPhone, t: TFunction): string => {
        return t("errors.please_enter_a_valid_phone_number");
    },
};


