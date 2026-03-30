import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

export const TYPE_MAPPING = {
  [TSurveyElementTypeEnum.CTA]: ["checkbox"],
  [TSurveyElementTypeEnum.MultipleChoiceMulti]: ["multi_select"],
  [TSurveyElementTypeEnum.MultipleChoiceSingle]: ["select", "status"],
  [TSurveyElementTypeEnum.OpenText]: [
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
  [TSurveyElementTypeEnum.NPS]: ["number"],
  [TSurveyElementTypeEnum.Consent]: ["checkbox"],
  [TSurveyElementTypeEnum.Rating]: ["number"],
  [TSurveyElementTypeEnum.PictureSelection]: ["url"],
  [TSurveyElementTypeEnum.FileUpload]: ["url"],
  [TSurveyElementTypeEnum.Date]: ["date"],
  [TSurveyElementTypeEnum.Address]: ["rich_text"],
  [TSurveyElementTypeEnum.Matrix]: ["rich_text"],
  [TSurveyElementTypeEnum.Cal]: ["checkbox"],
  [TSurveyElementTypeEnum.ContactInfo]: ["rich_text"],
  [TSurveyElementTypeEnum.Ranking]: ["rich_text"],
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
