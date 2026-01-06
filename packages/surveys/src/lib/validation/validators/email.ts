import type { TFunction } from "i18next";
import { ZEmail } from "@formbricks/types/common";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsEmail } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

export const emailValidator: TValidator<TValidationRuleParamsEmail> = {
    check: (value: TResponseDataValue, _params: TValidationRuleParamsEmail, _element: TSurveyElement): TValidatorCheckResult => {
        // Skip validation if value is empty (let required handle empty)
        if (!value || typeof value !== "string" || value === "") {
            return { valid: true };
        }
        return { valid: ZEmail.safeParse(value).success };
    },

    getDefaultMessage: (_params: TValidationRuleParamsEmail, t: TFunction): string => {
        return t("errors.please_enter_a_valid_email_address");
    },
};


