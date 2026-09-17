import { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";

const OP = ZSurveyLogicConditionsOperator.enum;

/**
 * The worded equality pair. Shared rather than repeated because every string-ish family opens with
 * it, and Sonar counts a copied literal block as duplicated code even when the copies are correct.
 */
const getEqualityOptions = (t: TFunction) => [
  { label: t("workspace.surveys.edit.equals"), value: OP.equals },
  { label: t("workspace.surveys.edit.does_not_equal"), value: OP.doesNotEqual },
];

/** The six symbol-labelled numeric comparisons, shared by numeric scales, number variables and reserved numbers. */
const getNumberComparisonOptions = () => [
  { label: "=", value: OP.equals },
  { label: "!=", value: OP.doesNotEqual },
  { label: ">", value: OP.isGreaterThan },
  { label: "<", value: OP.isLessThan },
  { label: ">=", value: OP.isGreaterThanOrEqual },
  { label: "<=", value: OP.isLessThanOrEqual },
];

/** Full string comparison set: equality plus the substring/affix operators. */
const getTextOperatorOptions = (t: TFunction) => [
  ...getEqualityOptions(t),
  { label: t("workspace.surveys.edit.contains"), value: OP.contains },
  { label: t("workspace.surveys.edit.does_not_contain"), value: OP.doesNotContain },
  { label: t("workspace.surveys.edit.starts_with"), value: OP.startsWith },
  { label: t("workspace.surveys.edit.does_not_start_with"), value: OP.doesNotStartWith },
  { label: t("workspace.surveys.edit.ends_with"), value: OP.endsWith },
  { label: t("workspace.surveys.edit.does_not_end_with"), value: OP.doesNotEndWith },
];

/**
 * Presence checks, offered by every reserved family (ENG-1840): a reserved value can legitimately be
 * absent - `source` on a link survey opened without one - and these are the only two operators that
 * let an author branch on that.
 */
const getPresenceOptions = (t: TFunction) => [
  { label: t("workspace.surveys.edit.is_set"), value: OP.isSet },
  { label: t("workspace.surveys.edit.is_not_set"), value: OP.isNotSet },
];

/**
 * Whether the respondent answered the element at all. Every element family offers this pair and
 * spelled it out inline — eleven copies of the same four lines, which Sonar counts as duplicated
 * code whether or not the copies agree.
 */
const getSubmissionOptions = (t: TFunction) => [
  { label: t("workspace.surveys.edit.is_submitted"), value: OP.isSubmitted },
  { label: t("workspace.surveys.edit.is_skipped"), value: OP.isSkipped },
];

/**
 * The set-membership operators a multi-select offers. MultipleChoiceMulti and PictureSelection have
 * always offered exactly this list, spelled out twice.
 */
const getMultiSelectOptions = (t: TFunction) => [
  { label: t("workspace.surveys.edit.does_not_include_one_of"), value: OP.doesNotIncludeOneOf },
  { label: t("workspace.surveys.edit.does_not_include_all_of"), value: OP.doesNotIncludeAllOf },
  { label: t("workspace.surveys.edit.includes_all_of"), value: OP.includesAllOf },
  { label: t("workspace.surveys.edit.includes_one_of"), value: OP.includesOneOf },
];

const getNumericScaleOptions = (t: TFunction) => ({
  options: [...getNumberComparisonOptions(), ...getSubmissionOptions(t)],
});

export const getLogicRules = (t: TFunction) => {
  const numericScaleOptions = getNumericScaleOptions(t);
  const equalityOptions = getEqualityOptions(t);
  const textOperatorOptions = getTextOperatorOptions(t);
  const numberComparisonOptions = getNumberComparisonOptions();
  const presenceOptions = getPresenceOptions(t);

  return {
    element: {
      [`${TSurveyElementTypeEnum.OpenText}.text`]: {
        options: [...getTextOperatorOptions(t), ...getSubmissionOptions(t)],
      },
      [`${TSurveyElementTypeEnum.OpenText}.number`]: {
        options: [...getNumberComparisonOptions(), ...getSubmissionOptions(t)],
      },
      [TSurveyElementTypeEnum.MultipleChoiceSingle]: {
        options: [
          ...getEqualityOptions(t),
          {
            label: t("workspace.surveys.edit.equals_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.equalsOneOf,
          },
          ...getSubmissionOptions(t),
        ],
      },
      [TSurveyElementTypeEnum.MultipleChoiceMulti]: {
        options: [...getEqualityOptions(t), ...getMultiSelectOptions(t), ...getSubmissionOptions(t)],
      },
      [TSurveyElementTypeEnum.PictureSelection]: {
        options: [...getEqualityOptions(t), ...getMultiSelectOptions(t), ...getSubmissionOptions(t)],
      },
      [TSurveyElementTypeEnum.Rating]: numericScaleOptions,
      [TSurveyElementTypeEnum.NPS]: numericScaleOptions,
      [TSurveyElementTypeEnum.CSAT]: numericScaleOptions,
      [TSurveyElementTypeEnum.CES]: numericScaleOptions,
      [TSurveyElementTypeEnum.CTA]: {
        options: [
          {
            label: t("workspace.surveys.edit.is_clicked"),
            value: ZSurveyLogicConditionsOperator.enum.isClicked,
          },
          {
            label: t("workspace.surveys.edit.is_not_clicked"),
            value: ZSurveyLogicConditionsOperator.enum.isNotClicked,
          },
        ],
      },
      [TSurveyElementTypeEnum.Consent]: {
        options: [
          {
            label: t("workspace.surveys.edit.is_accepted"),
            value: ZSurveyLogicConditionsOperator.enum.isAccepted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Date]: {
        options: [
          ...getEqualityOptions(t),
          {
            label: t("workspace.surveys.edit.is_before"),
            value: ZSurveyLogicConditionsOperator.enum.isBefore,
          },
          {
            label: t("workspace.surveys.edit.is_after"),
            value: ZSurveyLogicConditionsOperator.enum.isAfter,
          },
          ...getSubmissionOptions(t),
        ],
      },
      [TSurveyElementTypeEnum.FileUpload]: {
        options: [...getSubmissionOptions(t)],
      },
      [TSurveyElementTypeEnum.Ranking]: {
        options: [...getSubmissionOptions(t)],
      },
      [TSurveyElementTypeEnum.Cal]: {
        options: [
          {
            label: t("workspace.surveys.edit.is_booked"),
            value: ZSurveyLogicConditionsOperator.enum.isBooked,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Matrix]: {
        options: [
          {
            label: t("workspace.surveys.edit.is_partially_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isPartiallySubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_completely_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isCompletelySubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [`${TSurveyElementTypeEnum.Matrix}.row`]: {
        options: [
          ...getEqualityOptions(t),
          {
            label: t("workspace.surveys.edit.is_empty"),
            value: ZSurveyLogicConditionsOperator.enum.isEmpty,
          },

          {
            label: t("workspace.surveys.edit.is_not_empty"),
            value: ZSurveyLogicConditionsOperator.enum.isNotEmpty,
          },
          {
            label: t("workspace.surveys.edit.is_any_of"),
            value: ZSurveyLogicConditionsOperator.enum.isAnyOf,
          },
        ],
      },
      [TSurveyElementTypeEnum.Address]: {
        options: [...getSubmissionOptions(t)],
      },
      [TSurveyElementTypeEnum.ContactInfo]: {
        options: [...getSubmissionOptions(t)],
      },
    },
    ["variable.text"]: { options: textOperatorOptions },
    ["variable.number"]: { options: numberComparisonOptions },
    /*
     * **The dataType-keyed families.** Reserved fields (ENG-1840) are keyed by the catalog entry's
     * `dataType` rather than by name, so a new entry inherits the right operators from the type it
     * already declares instead of needing a rule set of its own.
     *
     * ENG-1853 pointed **ingested Embedded Data fields** at these same four, which is why they are
     * `field.*` and not `reserved.*`: an ingested field declares a `dataType` exactly as a catalog
     * entry does, so a `boolean` one gets equality and a `date` one gets isBefore/isAfter instead of
     * the free-text set every hidden field used to get regardless of what it holds. There was a
     * separate `hiddenField` family until then; it was byte-identical to `field.string`, which is
     * also why a legacy survey — where every ingested field is a `string` — sees exactly the
     * operators it saw before.
     *
     * Every family keeps isSet/isNotSet: such a value can legitimately be absent (`source` on a link
     * survey opened without one), and those two are the only operators that let an author branch on
     * that.
     */
    ["field.string"]: { options: [...textOperatorOptions, ...presenceOptions] },
    ["field.number"]: { options: [...numberComparisonOptions, ...presenceOptions] },
    // Booleans project as the strings "true"/"false" (see `projectReservedValues`), so equality is
    // the only comparison that means anything — ordering or substring operators would invite a
    // condition that reads sensibly and never matches.
    ["field.boolean"]: { options: [...equalityOptions, ...presenceOptions] },
    ["field.date"]: {
      options: [
        ...equalityOptions,
        { label: t("workspace.surveys.edit.is_before"), value: ZSurveyLogicConditionsOperator.enum.isBefore },
        { label: t("workspace.surveys.edit.is_after"), value: ZSurveyLogicConditionsOperator.enum.isAfter },
        ...presenceOptions,
      ],
    },
  };
};

export type TLogicRuleOption = ReturnType<typeof getLogicRules>["element"][keyof ReturnType<
  typeof getLogicRules
>["element"]]["options"];
