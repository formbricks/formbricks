import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

export interface ProcessedResponseElement {
  element: string;
  response: string | string[];
  type: TSurveyElementTypeEnum;
}

export interface ProcessedVariable {
  id: string;
  name: string;
  type: "text" | "number";
  value: string | number;
}

export interface ProcessedHiddenField {
  /** The storage key the value was read from — the row key, never the label. */
  id: string;
  /** What the field is called, disambiguated on collision (`labelEmbeddedFields`). */
  name: string;
  value: string;
}
