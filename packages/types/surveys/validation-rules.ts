import { z } from "zod";
import { ZI18nString } from "../i18n";

// Validation rule type enum - extensible for future rule types
export const ZValidationRuleType = z.enum([
  // Universal rules
  "required",

  // Text/OpenText rules
  "minLength",
  "maxLength",
  "pattern",
  "email",
  "url",
  "phone",

  // Numeric rules (for OpenText inputType=number)
  "minValue",
  "maxValue",

  // Selection rules (MultiSelect, PictureSelection)
  "minSelections",
  "maxSelections",
]);

export type TValidationRuleType = z.infer<typeof ZValidationRuleType>;

// Rule params - union for type-safe params per rule type (type is now at rule level)
export const ZValidationRuleParamsRequired = z.object({});

export const ZValidationRuleParamsMinLength = z.object({
  min: z.number().min(0),
});

export const ZValidationRuleParamsMaxLength = z.object({
  max: z.number().min(1),
});

export const ZValidationRuleParamsPattern = z.object({
  pattern: z.string().min(1),
  flags: z.string().optional(),
});

export const ZValidationRuleParamsEmail = z.object({});

export const ZValidationRuleParamsUrl = z.object({});

export const ZValidationRuleParamsPhone = z.object({});

export const ZValidationRuleParamsMinValue = z.object({
  min: z.number(),
});

export const ZValidationRuleParamsMaxValue = z.object({
  max: z.number(),
});

export const ZValidationRuleParamsMinSelections = z.object({
  min: z.number().min(1),
});

export const ZValidationRuleParamsMaxSelections = z.object({
  max: z.number().min(1),
});

// Union of all params types
export const ZValidationRuleParams = z.union([
  ZValidationRuleParamsRequired,
  ZValidationRuleParamsMinLength,
  ZValidationRuleParamsMaxLength,
  ZValidationRuleParamsPattern,
  ZValidationRuleParamsEmail,
  ZValidationRuleParamsUrl,
  ZValidationRuleParamsPhone,
  ZValidationRuleParamsMinValue,
  ZValidationRuleParamsMaxValue,
  ZValidationRuleParamsMinSelections,
  ZValidationRuleParamsMaxSelections,
]);

export type TValidationRuleParams = z.infer<typeof ZValidationRuleParams>;

// Extract specific param types for validators
export type TValidationRuleParamsRequired = z.infer<typeof ZValidationRuleParamsRequired>;
export type TValidationRuleParamsMinLength = z.infer<typeof ZValidationRuleParamsMinLength>;
export type TValidationRuleParamsMaxLength = z.infer<typeof ZValidationRuleParamsMaxLength>;
export type TValidationRuleParamsPattern = z.infer<typeof ZValidationRuleParamsPattern>;
export type TValidationRuleParamsEmail = z.infer<typeof ZValidationRuleParamsEmail>;
export type TValidationRuleParamsUrl = z.infer<typeof ZValidationRuleParamsUrl>;
export type TValidationRuleParamsPhone = z.infer<typeof ZValidationRuleParamsPhone>;
export type TValidationRuleParamsMinValue = z.infer<typeof ZValidationRuleParamsMinValue>;
export type TValidationRuleParamsMaxValue = z.infer<typeof ZValidationRuleParamsMaxValue>;
export type TValidationRuleParamsMinSelections = z.infer<typeof ZValidationRuleParamsMinSelections>;
export type TValidationRuleParamsMaxSelections = z.infer<typeof ZValidationRuleParamsMaxSelections>;

// Validation rule stored on element - discriminated union with type at top level
export const ZValidationRule = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("minLength"),
    params: ZValidationRuleParamsMinLength,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("maxLength"),
    params: ZValidationRuleParamsMaxLength,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("pattern"),
    params: ZValidationRuleParamsPattern,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("email"),
    params: ZValidationRuleParamsEmail,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("url"),
    params: ZValidationRuleParamsUrl,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("phone"),
    params: ZValidationRuleParamsPhone,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("minValue"),
    params: ZValidationRuleParamsMinValue,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("maxValue"),
    params: ZValidationRuleParamsMaxValue,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("minSelections"),
    params: ZValidationRuleParamsMinSelections,
    customErrorMessage: ZI18nString.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("maxSelections"),
    params: ZValidationRuleParamsMaxSelections,
    customErrorMessage: ZI18nString.optional(),
  }),
]);

export type TValidationRule = z.infer<typeof ZValidationRule>;

// Array of validation rules
export const ZValidationRules = z.array(ZValidationRule);
export type TValidationRules = z.infer<typeof ZValidationRules>;

// Applicable rules per element type - const arrays for type inference (must be defined before types)
const OPEN_TEXT_RULES = [
  "required",
  "minLength",
  "maxLength",
  "pattern",
  "email",
  "url",
  "phone",
  "minValue",
  "maxValue",
] as const;

const MULTIPLE_CHOICE_SINGLE_RULES = ["required"] as const;
const MULTIPLE_CHOICE_MULTI_RULES = ["required", "minSelections", "maxSelections"] as const;
const RATING_RULES = ["required"] as const;
const NPS_RULES = ["required"] as const;
const DATE_RULES = ["required"] as const;
const CONSENT_RULES = ["required"] as const;
const MATRIX_RULES = ["required"] as const;
const RANKING_RULES = ["required"] as const;
const FILE_UPLOAD_RULES = ["required"] as const;
const PICTURE_SELECTION_RULES = ["required", "minSelections", "maxSelections"] as const;
const ADDRESS_RULES = ["required"] as const;
const CONTACT_INFO_RULES = ["required"] as const;
const CAL_RULES = ["required"] as const;
const CTA_RULES = [] as const;

// Applicable rules per element type
export const APPLICABLE_RULES: Record<string, TValidationRuleType[]> = {
  openText: [...OPEN_TEXT_RULES],
  multipleChoiceSingle: [...MULTIPLE_CHOICE_SINGLE_RULES],
  multipleChoiceMulti: [...MULTIPLE_CHOICE_MULTI_RULES],
  rating: [...RATING_RULES],
  nps: [...NPS_RULES],
  date: [...DATE_RULES],
  consent: [...CONSENT_RULES],
  matrix: [...MATRIX_RULES],
  ranking: [...RANKING_RULES],
  fileUpload: [...FILE_UPLOAD_RULES],
  pictureSelection: [...PICTURE_SELECTION_RULES],
  address: [...ADDRESS_RULES],
  contactInfo: [...CONTACT_INFO_RULES],
  cal: [...CAL_RULES],
  cta: [...CTA_RULES], // CTA never validates
};

// Type helper to filter validation rules by allowed types
export type TValidationRuleForElementType<T extends TValidationRuleType> = Extract<
  TValidationRule,
  { type: T }
>;

// Type helper to get validation rules array for specific element type
export type TValidationRulesForElementType<T extends readonly TValidationRuleType[]> =
  TValidationRuleForElementType<T[number]>[];

// Specific validation rule types for each element type
export type TValidationRulesForOpenText = TValidationRulesForElementType<typeof OPEN_TEXT_RULES>;
export type TValidationRulesForMultipleChoiceSingle = TValidationRulesForElementType<
  typeof MULTIPLE_CHOICE_SINGLE_RULES
>;
export type TValidationRulesForMultipleChoiceMulti = TValidationRulesForElementType<
  typeof MULTIPLE_CHOICE_MULTI_RULES
>;
export type TValidationRulesForRating = TValidationRulesForElementType<typeof RATING_RULES>;
export type TValidationRulesForNPS = TValidationRulesForElementType<typeof NPS_RULES>;
export type TValidationRulesForDate = TValidationRulesForElementType<typeof DATE_RULES>;
export type TValidationRulesForConsent = TValidationRulesForElementType<typeof CONSENT_RULES>;
export type TValidationRulesForMatrix = TValidationRulesForElementType<typeof MATRIX_RULES>;
export type TValidationRulesForRanking = TValidationRulesForElementType<typeof RANKING_RULES>;
export type TValidationRulesForFileUpload = TValidationRulesForElementType<typeof FILE_UPLOAD_RULES>;
export type TValidationRulesForPictureSelection = TValidationRulesForElementType<
  typeof PICTURE_SELECTION_RULES
>;
export type TValidationRulesForAddress = TValidationRulesForElementType<typeof ADDRESS_RULES>;
export type TValidationRulesForContactInfo = TValidationRulesForElementType<typeof CONTACT_INFO_RULES>;
export type TValidationRulesForCal = TValidationRulesForElementType<typeof CAL_RULES>;
export type TValidationRulesForCTA = TValidationRulesForElementType<typeof CTA_RULES>;

// Validation error returned by evaluator
export interface TValidationError {
  ruleId: string;
  ruleType: TValidationRuleType;
  message: string;
}

// Validation result for a single element
export interface TValidationResult {
  valid: boolean;
  errors: TValidationError[];
}

// Error map for block-level validation (keyed by elementId)
export type TValidationErrorMap = Record<string, TValidationError[]>;

// Element-specific validation rules schemas (manually created for type safety)
// These are narrowed versions of ZValidationRule that only include applicable rule types
export const ZValidationRulesForOpenText: z.ZodType<TValidationRulesForOpenText> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("required"),
      params: ZValidationRuleParamsRequired,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("minLength"),
      params: ZValidationRuleParamsMinLength,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("maxLength"),
      params: ZValidationRuleParamsMaxLength,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("pattern"),
      params: ZValidationRuleParamsPattern,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("email"),
      params: ZValidationRuleParamsEmail,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("url"),
      params: ZValidationRuleParamsUrl,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("phone"),
      params: ZValidationRuleParamsPhone,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("minValue"),
      params: ZValidationRuleParamsMinValue,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("maxValue"),
      params: ZValidationRuleParamsMaxValue,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);

export const ZValidationRulesForMultipleChoiceSingle: z.ZodType<TValidationRulesForMultipleChoiceSingle> =
  z.array(
    z.object({
      id: z.string(),
      type: z.literal("required"),
      params: ZValidationRuleParamsRequired,
      customErrorMessage: ZI18nString.optional(),
    })
  );

export const ZValidationRulesForMultipleChoiceMulti: z.ZodType<TValidationRulesForMultipleChoiceMulti> =
  z.array(
    z.discriminatedUnion("type", [
      z.object({
        id: z.string(),
        type: z.literal("required"),
        params: ZValidationRuleParamsRequired,
        customErrorMessage: ZI18nString.optional(),
      }),
      z.object({
        id: z.string(),
        type: z.literal("minSelections"),
        params: ZValidationRuleParamsMinSelections,
        customErrorMessage: ZI18nString.optional(),
      }),
      z.object({
        id: z.string(),
        type: z.literal("maxSelections"),
        params: ZValidationRuleParamsMaxSelections,
        customErrorMessage: ZI18nString.optional(),
      }),
    ])
  );

export const ZValidationRulesForRating: z.ZodType<TValidationRulesForRating> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForNPS: z.ZodType<TValidationRulesForNPS> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForDate: z.ZodType<TValidationRulesForDate> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForConsent: z.ZodType<TValidationRulesForConsent> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForMatrix: z.ZodType<TValidationRulesForMatrix> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForRanking: z.ZodType<TValidationRulesForRanking> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForFileUpload: z.ZodType<TValidationRulesForFileUpload> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForPictureSelection: z.ZodType<TValidationRulesForPictureSelection> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("required"),
      params: ZValidationRuleParamsRequired,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("minSelections"),
      params: ZValidationRuleParamsMinSelections,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("maxSelections"),
      params: ZValidationRuleParamsMaxSelections,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);

export const ZValidationRulesForAddress: z.ZodType<TValidationRulesForAddress> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForContactInfo: z.ZodType<TValidationRulesForContactInfo> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForCal: z.ZodType<TValidationRulesForCal> = z.array(
  z.object({
    id: z.string(),
    type: z.literal("required"),
    params: ZValidationRuleParamsRequired,
    customErrorMessage: ZI18nString.optional(),
  })
);

export const ZValidationRulesForCTA: z.ZodType<TValidationRulesForCTA> = z.array(z.never());
