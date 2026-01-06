import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParamsRequired } from "@formbricks/types/surveys/validation-rules";
import type { TValidator, TValidatorCheckResult } from "./types";

export const requiredValidator: TValidator<TValidationRuleParamsRequired> = {
    check: (value: TResponseDataValue, _params: TValidationRuleParamsRequired, _element: TSurveyElement): TValidatorCheckResult => {
        const isEmpty =
            value === undefined ||
            value === null ||
            value === "" ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0);

        return { valid: !isEmpty };
    },

    getDefaultMessage: (_params: TValidationRuleParamsRequired, t: TFunction): string => {
        return t("errors.please_fill_out_this_field");
    },
};


