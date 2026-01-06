import type { TFunction } from "i18next";
import { ZUrl } from "@formbricks/types/common";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsUrl } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

export const urlValidator: TValidator<TValidationRuleParamsUrl> = {
    check: (value: TResponseDataValue, _params: TValidationRuleParamsUrl, _element: TSurveyElement): TValidatorCheckResult => {
        // Skip validation if value is empty (let required handle empty)
        if (!value || typeof value !== "string" || value === "") {
            return { valid: true };
        }
        return { valid: ZUrl.safeParse(value).success };
    },

    getDefaultMessage: (_params: TValidationRuleParamsUrl, t: TFunction): string => {
        return t("errors.please_enter_a_valid_url");
    },
};


