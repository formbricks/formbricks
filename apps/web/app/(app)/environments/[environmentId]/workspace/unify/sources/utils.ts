import { THubFieldType } from "@formbricks/types/connector";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSourceField } from "./types";

export const elementTypeToHubFieldType = (type: TSurveyElementTypeEnum): THubFieldType => {
  switch (type) {
    case TSurveyElementTypeEnum.OpenText:
      return "text";
    case TSurveyElementTypeEnum.Rating:
      return "rating";
    case TSurveyElementTypeEnum.NPS:
      return "nps";
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return "categorical";
    case TSurveyElementTypeEnum.Date:
      return "date";
    case TSurveyElementTypeEnum.Consent:
      return "boolean";
    case TSurveyElementTypeEnum.Matrix:
    case TSurveyElementTypeEnum.Ranking:
    case TSurveyElementTypeEnum.PictureSelection:
      return "categorical";
    case TSurveyElementTypeEnum.ContactInfo:
    case TSurveyElementTypeEnum.Address:
    case TSurveyElementTypeEnum.FileUpload:
    case TSurveyElementTypeEnum.Cal:
      return "text";
    case TSurveyElementTypeEnum.CTA:
      return "boolean";
    default:
      return "text";
  }
};

export const parseCSVColumnsToFields = (columns: string): TSourceField[] => {
  return columns.split(",").map((col) => {
    const trimmed = col.trim();
    return { id: trimmed, name: trimmed, type: "string", sampleValue: `Sample ${trimmed}` };
  });
};
