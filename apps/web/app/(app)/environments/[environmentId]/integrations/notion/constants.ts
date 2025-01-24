import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const TYPE_MAPPING = {
  [TSurveyQuestionTypeEnum.CTA]: ["checkbox"],
  [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: ["multi_select"],
  [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: ["select", "status"],
  [TSurveyQuestionTypeEnum.OpenText]: [
    "created_by",
    "created_time",
    "email",
    "last_edited_by",
    "last_edited_time",
    "number",
    "phone_number",
    "rich_text",
    "title",
    "url",
  ],
  [TSurveyQuestionTypeEnum.NPS]: ["number"],
  [TSurveyQuestionTypeEnum.Consent]: ["checkbox"],
  [TSurveyQuestionTypeEnum.Rating]: ["number"],
  [TSurveyQuestionTypeEnum.PictureSelection]: ["url"],
  [TSurveyQuestionTypeEnum.FileUpload]: ["url"],
  [TSurveyQuestionTypeEnum.Date]: ["date"],
  [TSurveyQuestionTypeEnum.Address]: ["rich_text"],
  [TSurveyQuestionTypeEnum.Matrix]: ["rich_text"],
  [TSurveyQuestionTypeEnum.Cal]: ["checkbox"],
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
