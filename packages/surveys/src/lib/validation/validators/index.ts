import type { TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import type { TValidator } from "./types";
import { requiredValidator } from "./required";
import { minLengthValidator } from "./min-length";
import { maxLengthValidator } from "./max-length";
import { emailValidator } from "./email";
import { urlValidator } from "./url";
import { phoneValidator } from "./phone";
import { patternValidator } from "./pattern";
import { minValueValidator } from "./min-value";
import { maxValueValidator } from "./max-value";
import { minSelectionsValidator } from "./min-selections";
import { maxSelectionsValidator } from "./max-selections";

/**
 * Registry of all validators, keyed by rule type.
 * Each validator implements the TValidator interface.
 * We use `as TValidator` to work around TypeScript's strict generics for the discriminated union.
 */
export const validators: Record<TValidationRuleType, TValidator> = {
    required: requiredValidator as TValidator,
    minLength: minLengthValidator as TValidator,
    maxLength: maxLengthValidator as TValidator,
    email: emailValidator as TValidator,
    url: urlValidator as TValidator,
    phone: phoneValidator as TValidator,
    pattern: patternValidator as TValidator,
    minValue: minValueValidator as TValidator,
    maxValue: maxValueValidator as TValidator,
    minSelections: minSelectionsValidator as TValidator,
    maxSelections: maxSelectionsValidator as TValidator,
};

export type { TValidator, TValidatorCheckResult } from "./types";
