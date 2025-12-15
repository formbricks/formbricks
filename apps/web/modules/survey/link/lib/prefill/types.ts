import { TSurveyElementChoice, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

type TInvalidResult = {
  isValid: false;
};

// Base valid result for simple types (no match data needed)
type TSimpleValidResult = {
  isValid: true;
};

// Single choice match result (MultipleChoiceSingle)
type TSingleChoiceValidResult = {
  isValid: true;
  matchedChoice: TSurveyElementChoice | null; // null means "other" value
};

// Multi choice match result (MultipleChoiceMulti)
type TMultiChoiceValidResult = {
  isValid: true;
  matched: string[]; // matched labels
  others: string[]; // other text values
};

// Ranking match result
type TRankingValidResult = {
  isValid: true;
  matchedChoices: TSurveyElementChoice[];
};

// Picture selection result (indices are already validated)
type TPictureSelectionValidResult = {
  isValid: true;
  selectedIds: string[];
};

// Discriminated union for all validation results
export type TValidationResult =
  | (TInvalidResult & { type?: TSurveyElementTypeEnum })
  | (TSimpleValidResult & {
      type:
        | TSurveyElementTypeEnum.OpenText
        | TSurveyElementTypeEnum.NPS
        | TSurveyElementTypeEnum.Rating
        | TSurveyElementTypeEnum.CTA
        | TSurveyElementTypeEnum.Consent;
    })
  | (TSingleChoiceValidResult & { type: TSurveyElementTypeEnum.MultipleChoiceSingle })
  | (TMultiChoiceValidResult & { type: TSurveyElementTypeEnum.MultipleChoiceMulti })
  | (TRankingValidResult & { type: TSurveyElementTypeEnum.Ranking })
  | (TPictureSelectionValidResult & { type: TSurveyElementTypeEnum.PictureSelection });

// Type guards for narrowing validation results
export const isValidResult = (result: TValidationResult): result is TValidationResult & { isValid: true } =>
  result.isValid;

export const isSingleChoiceResult = (
  result: TValidationResult
): result is TSingleChoiceValidResult & { type: TSurveyElementTypeEnum.MultipleChoiceSingle } =>
  result.isValid && result.type === TSurveyElementTypeEnum.MultipleChoiceSingle;

export const isMultiChoiceResult = (
  result: TValidationResult
): result is TMultiChoiceValidResult & { type: TSurveyElementTypeEnum.MultipleChoiceMulti } =>
  result.isValid && result.type === TSurveyElementTypeEnum.MultipleChoiceMulti;

export const isRankingResult = (
  result: TValidationResult
): result is TRankingValidResult & { type: TSurveyElementTypeEnum.Ranking } =>
  result.isValid && result.type === TSurveyElementTypeEnum.Ranking;

export const isPictureSelectionResult = (
  result: TValidationResult
): result is TPictureSelectionValidResult & { type: TSurveyElementTypeEnum.PictureSelection } =>
  result.isValid && result.type === TSurveyElementTypeEnum.PictureSelection;
