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

export const parsePayloadToFields = (payload: Record<string, unknown>): TSourceField[] => {
  const fields: TSourceField[] = [];

  const extractFields = (obj: Record<string, unknown>, prefix = ""): void => {
    for (const [key, value] of Object.entries(obj)) {
      const fieldId = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        fields.push({ id: fieldId, name: fieldId, type: "string", sampleValue: String(value) });
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          fields.push({ id: fieldId, name: fieldId, type: "array", sampleValue: "[]" });
        } else {
          const maxItems = Math.min(value.length, 3);
          for (let i = 0; i < maxItems; i++) {
            const item = value[i];
            const itemPrefix = `${fieldId}[${i}]`;

            if (item !== null && typeof item === "object" && !Array.isArray(item)) {
              extractFields(item as Record<string, unknown>, itemPrefix);
            } else if (Array.isArray(item)) {
              fields.push({
                id: itemPrefix,
                name: itemPrefix,
                type: "array",
                sampleValue: `[${item.length} items]`,
              });
            } else {
              let type = "string";
              if (typeof item === "number") type = "number";
              if (typeof item === "boolean") type = "boolean";
              fields.push({ id: itemPrefix, name: itemPrefix, type, sampleValue: String(item) });
            }
          }
          if (value.length > 3) {
            fields.push({
              id: `${fieldId}[...]`,
              name: `${fieldId}[...]`,
              type: "info",
              sampleValue: `+${value.length - 3} more items`,
            });
          }
        }
      } else if (typeof value === "object") {
        extractFields(value as Record<string, unknown>, fieldId);
      } else {
        let type = "string";
        if (typeof value === "number") type = "number";
        if (typeof value === "boolean") type = "boolean";
        fields.push({ id: fieldId, name: fieldId, type, sampleValue: String(value) });
      }
    }
  };

  extractFields(payload);
  return fields;
};

export const parseCSVColumnsToFields = (columns: string): TSourceField[] => {
  return columns.split(",").map((col) => {
    const trimmed = col.trim();
    return { id: trimmed, name: trimmed, type: "string", sampleValue: `Sample ${trimmed}` };
  });
};
