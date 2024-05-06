import { isLabelValidForAllLanguages } from "@formbricks/lib/i18n/utils";
import { TI18nString } from "@formbricks/types/surveys";

export const isValueIncomplete = (
  id: string,
  isInvalid: boolean,
  surveyLanguageCodes: string[],
  value?: TI18nString
) => {
  // Define a list of IDs for which a default value needs to be checked.
  const labelIds = [
    "label",
    "headline",
    "subheader",
    "lowerLabel",
    "upperLabel",
    "buttonLabel",
    "placeholder",
    "backButtonLabel",
    "dismissButtonLabel",
  ];

  // If value is not provided, immediately return false as it cannot be incomplete.
  if (value === undefined) return false;

  // Check if the default value is incomplete. This applies only to specific label IDs.
  // For these IDs, the default value should not be an empty string.
  const isDefaultIncomplete = labelIds.includes(id) ? value["default"]?.trim() !== "" : false;

  // Return true if all the following conditions are met:
  // 1. The field is marked as invalid.
  // 2. The label is not valid for all provided language codes in the survey.
  // 4. For specific label IDs, the default value is incomplete as defined above.
  return isInvalid && !isLabelValidForAllLanguages(value, surveyLanguageCodes) && isDefaultIncomplete;
};
