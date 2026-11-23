import type { TFunction } from "i18next";
import type { LucideIcon } from "lucide-react";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import type {
  TWorkflowResponseSection,
  TWorkflowVariableOption,
} from "@/modules/ee/workflows/lib/variable-picker";
import {
  EMBEDDED_FIELD_ICON_BY_DATA_TYPE,
  getReservedFieldIcon,
} from "@/modules/embedded-data/lib/field-display";
import { elementIconMapping } from "@/modules/survey/components/element-form-input/components/recall-item-select";

/**
 * A response Variable's icon, the one the survey editor's field pickers draw for it: the question
 * type, an Embedded Data field's data type, or a built-in (Survey info) field's own icon. Undefined
 * for anything else (payload, step outputs), which keep their own.
 */
export const getResponseOptionIcon = (
  iconKey: TWorkflowVariableOption["iconKey"]
): LucideIcon | undefined => {
  if (!iconKey) return undefined;
  if (iconKey.startsWith("dataType:")) {
    return EMBEDDED_FIELD_ICON_BY_DATA_TYPE[iconKey.slice("dataType:".length) as TEmbeddedDataType];
  }
  if (iconKey.startsWith("reserved:")) return getReservedFieldIcon(iconKey.slice("reserved:".length));
  return iconKey in elementIconMapping
    ? elementIconMapping[iconKey as keyof typeof elementIconMapping]
    : undefined;
};

/** The survey editor's field group headings (toSentenceFieldGroups), with the same labels. */
export const getResponseSectionLabel = (section: TWorkflowResponseSection, t: TFunction): string => {
  switch (section) {
    case "questions":
      return t("common.questions");
    case "hiddenFields":
      return t("common.hidden_fields");
    case "embeddedData":
      return t("common.embedded_data");
    case "surveyInfo":
      return t("workspace.surveys.edit.flow.survey_info");
  }
};
