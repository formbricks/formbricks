import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

// The response filter's option model: what can be filtered on (grouped by kind) and, per field, the
// operators and values it offers. Built by `generateElementAndFilterOptions` and read by the Responses
// toolbar's filter properties.

export enum OptionsType {
  ELEMENTS = "Elements",
  TAGS = "Tags",
  ATTRIBUTES = "Attributes",
  OTHERS = "Other Filters",
  META = "Meta",
  HIDDEN_FIELDS = "Hidden Fields",
  VARIABLES = "Variables",
  QUOTAS = "Quotas",
}

export type ElementOption = {
  label: string;
  elementType?: TSurveyElementTypeEnum;
  type: OptionsType;
  id: string;
};

export type ElementOptions = {
  header: OptionsType;
  option: ElementOption[];
};

export type ElementFilterOptions = {
  type:
    | TSurveyElementTypeEnum
    | "Attributes"
    | "Tags"
    | "Languages"
    | "Quotas"
    | "Hidden Fields"
    | "Meta"
    | "Variables"
    | OptionsType.OTHERS;
  filterOptions: (string | TI18nString)[];
  filterComboBoxOptions: (string | TI18nString)[];
  /** For Embedded Data / reserved fields: drives the operator set and the value input type. */
  fieldDataType?: TEmbeddedDataType;
  id: string;
};
