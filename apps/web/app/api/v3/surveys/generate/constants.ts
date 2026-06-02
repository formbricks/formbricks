import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";

export const V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH = 4;
export const V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH = 24;
export const V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS = 4;
export const V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH = 1200;

export const GENERATED_SURVEY_MIN_BLOCKS = 1;
export const GENERATED_SURVEY_MAX_BLOCKS = 8;
export const GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK = 1;
export const GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK = 4;
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
