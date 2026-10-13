import type { TComboboxGroupedOption } from "@/modules/ui/components/input-combo-box";
import type { TRetentionExemptionSurveyOption } from "../types";

/**
 * The exemption picker's options, one group per workspace in the order the server returned them.
 *
 * The chosen survey is kept in the list even when the current search no longer returns it: the
 * combobox shows its value by finding it among the options, so dropping it would blank the field.
 */
export const groupSurveyOptionsByWorkspace = (
  surveys: readonly TRetentionExemptionSurveyOption[],
  selected: TRetentionExemptionSurveyOption | null
): TComboboxGroupedOption[] => {
  const all =
    selected && !surveys.some((survey) => survey.id === selected.id) ? [selected, ...surveys] : surveys;

  const groups = new Map<string, TComboboxGroupedOption>();
  for (const survey of all) {
    const group = groups.get(survey.workspaceName) ?? {
      label: survey.workspaceName,
      value: survey.workspaceName,
      options: [],
    };
    group.options.push({ label: survey.name, value: survey.id });
    groups.set(survey.workspaceName, group);
  }
  return [...groups.values()];
};
