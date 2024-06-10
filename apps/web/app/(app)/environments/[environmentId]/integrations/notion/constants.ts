import { TSurveyQuestionType } from "@formbricks/types/surveys/types";

export const TYPE_MAPPING = {
  [TSurveyQuestionType.CTA]: ["checkbox"],
  [TSurveyQuestionType.MultipleChoiceMulti]: ["multi_select"],
  [TSurveyQuestionType.MultipleChoiceSingle]: ["select", "status"],
  [TSurveyQuestionType.OpenText]: [
    "created_by",
    "created_time",
    "date",
    "email",
    "last_edited_by",
    "last_edited_time",
    "number",
    "phone_number",
    "rich_text",
    "title",
    "url",
  ],
  [TSurveyQuestionType.NPS]: ["number"],
  [TSurveyQuestionType.Consent]: ["checkbox"],
  [TSurveyQuestionType.Rating]: ["number"],
  [TSurveyQuestionType.PictureSelection]: ["url"],
  [TSurveyQuestionType.FileUpload]: ["url"],
  [TSurveyQuestionType.Date]: ["date"],
  [TSurveyQuestionType.Address]: ["rich_text"],
  [TSurveyQuestionType.Matrix]: ["rich_text"],
  [TSurveyQuestionType.Cal]: ["checkbox"],
};

export const UNSUPPORTED_TYPES_BY_NOTION = [
  "rollup",
  "created_by",
  "created_time",
  "last_edited_by",
  "last_edited_time",
];

export const ERRORS = {
  MAPPING: "Mapping Error",
  UNSUPPORTED_TYPE: "Unsupported type by Notion",
};
