import { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";

export const getLogicRules = (t: TFunction) => {
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
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
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
            label: t("workspace.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
          },
          {
            label: t("workspace.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.enum.isSkipped,
          },
        ],
      },
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
    ["variable.text"]: {
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
  };
};

export type TLogicRuleOption = ReturnType<typeof getLogicRules>["element"][keyof ReturnType<
  typeof getLogicRules
>["element"]]["options"];
