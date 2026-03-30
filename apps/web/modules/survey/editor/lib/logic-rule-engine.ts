import { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";

export const getLogicRules = (t: TFunction) => {
  return {
    element: {
      [`${TSurveyElementTypeEnum.OpenText}.text`]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.contains"),
            value: ZSurveyLogicConditionsOperator.enum.contains,
          },
          {
            label: t("environments.surveys.edit.does_not_contain"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
          },
          {
            label: t("environments.surveys.edit.starts_with"),
            value: ZSurveyLogicConditionsOperator.enum.startsWith,
          },
          {
            label: t("environments.surveys.edit.does_not_start_with"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
          },
          {
            label: t("environments.surveys.edit.ends_with"),
            value: ZSurveyLogicConditionsOperator.enum.endsWith,
          },
          {
            label: t("environments.surveys.edit.does_not_end_with"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
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
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.MultipleChoiceSingle]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.equals_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.equalsOneOf,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.MultipleChoiceMulti]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.does_not_include_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeOneOf,
          },
          {
            label: t("environments.surveys.edit.does_not_include_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesOneOf,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.PictureSelection]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.does_not_include_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeOneOf,
          },
          {
            label: t("environments.surveys.edit.does_not_include_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_all_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_one_of"),
            value: ZSurveyLogicConditionsOperator.enum.includesOneOf,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Rating]: {
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
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.NPS]: {
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
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.CTA]: {
        options: [
          {
            label: t("environments.surveys.edit.is_clicked"),
            value: ZSurveyLogicConditionsOperator.enum.isClicked,
          },
          {
            label: t("environments.surveys.edit.is_not_clicked"),
            value: ZSurveyLogicConditionsOperator.enum.isNotClicked,
          },
        ],
      },
      [TSurveyElementTypeEnum.Consent]: {
        options: [
          {
            label: t("environments.surveys.edit.is_accepted"),
            value: ZSurveyLogicConditionsOperator.enum.isAccepted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Date]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.is_before"),
            value: ZSurveyLogicConditionsOperator.enum.isBefore,
          },
          {
            label: t("environments.surveys.edit.is_after"),
            value: ZSurveyLogicConditionsOperator.enum.isAfter,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.FileUpload]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Ranking]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Cal]: {
        options: [
          {
            label: t("environments.surveys.edit.is_booked"),
            value: ZSurveyLogicConditionsOperator.enum.isBooked,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.Matrix]: {
        options: [
          {
            label: t("environments.surveys.edit.is_partially_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isPartiallySubmitted,
          },
          {
            label: t("environments.surveys.edit.is_completely_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isCompletelySubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [`${TSurveyElementTypeEnum.Matrix}.row`]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.is_empty"),
            value: ZSurveyLogicConditionsOperator.enum.isEmpty,
          },

          {
            label: t("environments.surveys.edit.is_not_empty"),
            value: ZSurveyLogicConditionsOperator.enum.isNotEmpty,
          },
          {
            label: t("environments.surveys.edit.is_any_of"),
            value: ZSurveyLogicConditionsOperator.enum.isAnyOf,
          },
        ],
      },
      [TSurveyElementTypeEnum.Address]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
      [TSurveyElementTypeEnum.ContactInfo]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
    },
    ["variable.text"]: {
      options: [
        {
          label: t("environments.surveys.edit.equals"),
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: t("environments.surveys.edit.does_not_equal"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: t("environments.surveys.edit.contains"),
          value: ZSurveyLogicConditionsOperator.enum.contains,
        },
        {
          label: t("environments.surveys.edit.does_not_contain"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
        },
        {
          label: t("environments.surveys.edit.starts_with"),
          value: ZSurveyLogicConditionsOperator.enum.startsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_start_with"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
        },
        {
          label: t("environments.surveys.edit.ends_with"),
          value: ZSurveyLogicConditionsOperator.enum.endsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_end_with"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
        },
      ],
    },
    ["variable.number"]: {
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
      ],
    },
    hiddenField: {
      options: [
        {
          label: t("environments.surveys.edit.equals"),
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: t("environments.surveys.edit.does_not_equal"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: t("environments.surveys.edit.contains"),
          value: ZSurveyLogicConditionsOperator.enum.contains,
        },
        {
          label: t("environments.surveys.edit.does_not_contain"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
        },
        {
          label: t("environments.surveys.edit.starts_with"),
          value: ZSurveyLogicConditionsOperator.enum.startsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_start_with"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
        },
        {
          label: t("environments.surveys.edit.ends_with"),
          value: ZSurveyLogicConditionsOperator.enum.endsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_end_with"),
          value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
        },
        {
          label: t("environments.surveys.edit.is_set"),
          value: ZSurveyLogicConditionsOperator.enum.isSet,
        },
        {
          label: t("environments.surveys.edit.is_not_set"),
          value: ZSurveyLogicConditionsOperator.enum.isNotSet,
        },
      ],
    },
  };
};

export type TLogicRuleOption = ReturnType<typeof getLogicRules>["element"][keyof ReturnType<
  typeof getLogicRules
>["element"]]["options"];
