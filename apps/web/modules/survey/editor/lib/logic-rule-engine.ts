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

const getNumericScaleOptions = (t: TFunction) => ({
  options: [
    ...getNumberComparisonOptions(),
    {
      label: t("workspace.surveys.edit.is_submitted"),
      value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
    },
    {
      label: t("workspace.surveys.edit.is_skipped"),
      value: ZSurveyLogicConditionsOperator.enum.isSkipped,
    },
  ],
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
        options: [
          {
            label: t("workspace.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("workspace.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("workspace.surveys.edit.contains"),
            value: ZSurveyLogicConditionsOperator.enum.contains,
          },
          {
            label: t("workspace.surveys.edit.does_not_contain"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
          },
          {
            label: t("workspace.surveys.edit.starts_with"),
            value: ZSurveyLogicConditionsOperator.enum.startsWith,
          },
          {
            label: t("workspace.surveys.edit.does_not_start_with"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
          },
          {
            label: t("workspace.surveys.edit.ends_with"),
            value: ZSurveyLogicConditionsOperator.enum.endsWith,
          },
          {
            label: t("workspace.surveys.edit.does_not_end_with"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
          },
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [`${TSurveyElementTypeEnum.OpenText}.number`]: {
        options: [
          {
            label: "=",
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: "!=",
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: ">",
            value: ZSurveyLogicConditionsOperator.enum.isGreaterThan,
          },
          {
            label: "<",
            value: ZSurveyLogicConditionsOperator.enum.isLessThan,
          },
          {
            label: ">=",
            value: ZSurveyLogicConditionsOperator.enum.isGreaterThanOrEqual,
          },
          {
            label: "<=",
            value: ZSurveyLogicConditionsOperator.enum.isLessThanOrEqual,
          },
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.MultipleChoiceSingle]: {
        options: [
          {
            label: t("workspace.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("workspace.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("workspace.surveys.edit.equals_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.equalsOneOf,
          },
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.MultipleChoiceMulti]: {
        options: [
          {
            label: t("workspace.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("workspace.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("workspace.surveys.edit.does_not_include_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeOneOf,
          },
          {
            label: t("workspace.surveys.edit.does_not_include_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeAllOf,
          },
          {
            label: t("workspace.surveys.edit.includes_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesAllOf,
          },
          {
            label: t("workspace.surveys.edit.includes_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesOneOf,
          },
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.PictureSelection]: {
        options: [
          {
            label: t("workspace.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("workspace.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("workspace.surveys.edit.does_not_include_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeOneOf,
          },
          {
            label: t("workspace.surveys.edit.does_not_include_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeAllOf,
          },
          {
            label: t("workspace.surveys.edit.includes_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesAllOf,
          },
          {
            label: t("workspace.surveys.edit.includes_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesOneOf,
          },
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
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
          {
            label: t("workspace.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("workspace.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("workspace.surveys.edit.is_before"),
            value: ZSurveyLogicConditionsOperator.enum.isBefore,
          },
          {
            label: t("workspace.surveys.edit.is_after"),
            value: ZSurveyLogicConditionsOperator.enum.isAfter,
          },
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.FileUpload]: {
        options: [
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Ranking]: {
        options: [
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
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
          {
            label: t("workspace.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("workspace.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
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
        options: [
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.ContactInfo]: {
        options: [
          {
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
    },
    ["variable.text"]: { options: textOperatorOptions },
    ["variable.number"]: { options: numberComparisonOptions },
    hiddenField: {
      options: [
        {
          label: t("workspace.surveys.edit.equals"),
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: t("workspace.surveys.edit.does_not_equal"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: t("workspace.surveys.edit.contains"),
          value: ZSurveyLogicConditionsOperator.enum.contains,
        },
        {
          label: t("workspace.surveys.edit.does_not_contain"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
        },
        {
          label: t("workspace.surveys.edit.starts_with"),
          value: ZSurveyLogicConditionsOperator.enum.startsWith,
        },
        {
          label: t("workspace.surveys.edit.does_not_start_with"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
        },
        {
          label: t("workspace.surveys.edit.ends_with"),
          value: ZSurveyLogicConditionsOperator.enum.endsWith,
        },
        {
          label: t("workspace.surveys.edit.does_not_end_with"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
        },
        {
          label: t("workspace.surveys.edit.is_set"),
          value: ZSurveyLogicConditionsOperator.enum.isSet,
        },
        {
          label: t("workspace.surveys.edit.is_not_set"),
          value: ZSurveyLogicConditionsOperator.enum.isNotSet,
        },
      ],
    },
    /*
     * Reserved fields (ENG-1840) are keyed by the catalog entry's `dataType` rather than by name, so
     * a new entry inherits the right operators from the type it already declares instead of needing a
     * rule set of its own. Every family keeps isSet/isNotSet: a reserved value can legitimately be
     * absent (`source` on a link survey opened without one), and those two are the only operators
     * that let an author branch on that.
     */
    /*
     * Reserved fields (ENG-1840) are keyed by the catalog entry's `dataType`, so a new entry inherits
     * the right operators from the type it already declares instead of needing a rule set of its own.
     * Booleans project as the strings "true"/"false", so equality is the only comparison that means
     * anything there - ordering or substring operators would invite a condition that reads sensibly
     * and never matches.
     */
    ["reserved.string"]: { options: [...textOperatorOptions, ...presenceOptions] },
    ["reserved.number"]: { options: [...numberComparisonOptions, ...presenceOptions] },
    // Booleans project as the strings "true"/"false" (see `projectReservedValues`), so equality is
    // the only comparison that means anything — ordering or substring operators would invite a
    // condition that reads sensibly and never matches.
    ["reserved.boolean"]: { options: [...equalityOptions, ...presenceOptions] },
    ["reserved.date"]: {
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
