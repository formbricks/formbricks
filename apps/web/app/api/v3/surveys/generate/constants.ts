import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";

export const V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH = 4;
export const V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH = 24;
export const V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS = 4;
export const V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH = 1200;

export const GENERATED_SURVEY_MIN_BLOCKS = 1;
export const GENERATED_SURVEY_MAX_BLOCKS = 8;
export const GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK = 1;
export const GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK = 4;
export const GENERATED_SURVEY_MAX_CHOICES = 8;

/**
 * Import variant (D4): chunking handles anything longer. A block may hold a whole chunk (24 questions):
 * documents keep their own sections, and the model was refused live for putting a 15-question
 * section into one block when the cap was 8. v3 has no per-block element limit.
 */
export const IMPORTED_SURVEY_MAX_BLOCKS = 16;
export const IMPORTED_SURVEY_MAX_QUESTIONS_PER_BLOCK = 24;
export const IMPORTED_SURVEY_MAX_CHOICES = 8;

export const IMPORT_ADDRESS_FIELDS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
] as const;
export const IMPORT_CONTACT_INFO_FIELDS = ["firstName", "lastName", "email", "phone", "company"] as const;
export const GENERATED_SURVEY_ELEMENT_TYPES = [
  TSurveyElementTypeEnum.OpenText,
  TSurveyElementTypeEnum.MultipleChoiceSingle,
  TSurveyElementTypeEnum.MultipleChoiceMulti,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
  TSurveyElementTypeEnum.Ranking,
  TSurveyElementTypeEnum.Matrix,
  TSurveyElementTypeEnum.Date,
] as const;

/**
 * The import draft adds the four types a document is likely to hold. `pictureSelection`, `fileUpload`
 * and `cal` stay out (nearest type + `type_approximated`).
 */
export const IMPORTED_SURVEY_ELEMENT_TYPES = [
  ...GENERATED_SURVEY_ELEMENT_TYPES,
  TSurveyElementTypeEnum.CTA,
  TSurveyElementTypeEnum.Consent,
  TSurveyElementTypeEnum.Address,
  TSurveyElementTypeEnum.ContactInfo,
] as const;
