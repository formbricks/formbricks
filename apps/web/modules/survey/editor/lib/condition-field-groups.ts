import type { TFunction } from "i18next";
import type { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";

/**
 * The rule editor's and the show-if popovers' first selector (ENG-6969 T6): the fields in the groups
 * the rule sentence talks about, Questions, Hidden fields, Embedded Data and Survey info, each row with
 * its type icon and code. Regroups `getConditionValueOptions`, whose one Embedded Data group and
 * "Auto-captured" heading the shared pickers (quotas) keep: only the grouping changes here, never what
 * is offered.
 */
export const toSentenceFieldGroups = (
  groups: TComboboxGroupedOption[],
  t: TFunction
): TComboboxGroupedOption[] => {
  const optionsOf = (value: string): TComboboxOption[] =>
    groups.find((group) => group.value === value)?.options ?? [];
  const embeddedData = optionsOf("embeddedData");
  // An ingested field arrives from outside (a URL parameter, ex hidden field); a computed one is set
  // by the survey's own Set value steps. `meta.type` is what a saved condition stores for each.
  const isHiddenField = (option: TComboboxOption) => option.meta?.type === "hiddenField";
  const known = new Set(["elements", "embeddedData", "reservedFields"]);

  const sentenceGroups: TComboboxGroupedOption[] = [
    { label: t("common.questions"), value: "elements", options: optionsOf("elements") },
    { label: t("common.hidden_fields"), value: "hiddenFields", options: embeddedData.filter(isHiddenField) },
    {
      label: t("common.embedded_data"),
      value: "embeddedData",
      options: embeddedData.filter((option) => !isHiddenField(option)),
    },
    {
      label: t("workspace.surveys.edit.flow.survey_info"),
      value: "reservedFields",
      options: optionsOf("reservedFields"),
    },
    // Anything else the shared list grows later is kept, after these.
    ...groups.filter((group) => !known.has(String(group.value))),
  ];

  return sentenceGroups.filter((group) => group.options.length > 0);
};
