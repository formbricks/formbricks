import { TFnType } from "@tolgee/react";
import { TSurveyQuestionTypeEnum, ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/types";

export const getLogicRules = (t: TFnType) => {
  return {
    question: {
      [`${TSurveyQuestionTypeEnum.OpenText}.text`]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.contains"),
            value: ZSurveyLogicConditionsOperator.Enum.contains,
          },
          {
            label: t("environments.surveys.edit.does_not_contain"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
          },
          {
            label: t("environments.surveys.edit.starts_with"),
            value: ZSurveyLogicConditionsOperator.Enum.startsWith,
          },
          {
            label: t("environments.surveys.edit.does_not_start_with"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
          },
          {
            label: t("environments.surveys.edit.ends_with"),
            value: ZSurveyLogicConditionsOperator.Enum.endsWith,
          },
          {
            label: t("environments.surveys.edit.does_not_end_with"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [`${TSurveyQuestionTypeEnum.OpenText}.number`]: {
        options: [
          {
            label: "=",
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: "!=",
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: ">",
            value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan,
          },
          {
            label: "<",
            value: ZSurveyLogicConditionsOperator.Enum.isLessThan,
          },
          {
            label: ">=",
            value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual,
          },
          {
            label: "<=",
            value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.equals_one_of"),
            value: ZSurveyLogicConditionsOperator.Enum.equalsOneOf,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.does_not_include_one_of"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeOneOf,
          },
          {
            label: t("environments.surveys.edit.does_not_include_all_of"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_all_of"),
            value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_one_of"),
            value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.PictureSelection]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.does_not_include_one_of"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeOneOf,
          },
          {
            label: t("environments.surveys.edit.does_not_include_all_of"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_all_of"),
            value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
          },
          {
            label: t("environments.surveys.edit.includes_one_of"),
            value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.Rating]: {
        options: [
          {
            label: "=",
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: "!=",
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: ">",
            value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan,
          },
          {
            label: "<",
            value: ZSurveyLogicConditionsOperator.Enum.isLessThan,
          },
          {
            label: ">=",
            value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual,
          },
          {
            label: "<=",
            value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.NPS]: {
        options: [
          {
            label: "=",
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: "!=",
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: ">",
            value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan,
          },
          {
            label: "<",
            value: ZSurveyLogicConditionsOperator.Enum.isLessThan,
          },
          {
            label: ">=",
            value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual,
          },
          {
            label: "<=",
            value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.CTA]: {
        options: [
          {
            label: t("environments.surveys.edit.is_clicked"),
            value: ZSurveyLogicConditionsOperator.Enum.isClicked,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.Consent]: {
        options: [
          {
            label: t("environments.surveys.edit.is_accepted"),
            value: ZSurveyLogicConditionsOperator.Enum.isAccepted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.Date]: {
        options: [
          {
            label: t("environments.surveys.edit.equals"),
            value: ZSurveyLogicConditionsOperator.Enum.equals,
          },
          {
            label: t("environments.surveys.edit.does_not_equal"),
            value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
          },
          {
            label: t("environments.surveys.edit.is_before"),
            value: ZSurveyLogicConditionsOperator.Enum.isBefore,
          },
          {
            label: t("environments.surveys.edit.is_after"),
            value: ZSurveyLogicConditionsOperator.Enum.isAfter,
          },
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.FileUpload]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.Ranking]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.Cal]: {
        options: [
          {
            label: t("environments.surveys.edit.is_booked"),
            value: ZSurveyLogicConditionsOperator.Enum.isBooked,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.Matrix]: {
        options: [
          {
            label: t("environments.surveys.edit.is_partially_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
          },
          {
            label: t("environments.surveys.edit.is_completely_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.Address]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
      [TSurveyQuestionTypeEnum.ContactInfo]: {
        options: [
          {
            label: t("environments.surveys.edit.is_submitted"),
            value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
          },
          {
            label: t("environments.surveys.edit.is_skipped"),
            value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
          },
        ],
      },
    },
    ["variable.text"]: {
      options: [
        {
          label: t("environments.surveys.edit.equals"),
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: t("environments.surveys.edit.does_not_equal"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: t("environments.surveys.edit.contains"),
          value: ZSurveyLogicConditionsOperator.Enum.contains,
        },
        {
          label: t("environments.surveys.edit.does_not_contain"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
        },
        {
          label: t("environments.surveys.edit.starts_with"),
          value: ZSurveyLogicConditionsOperator.Enum.startsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_start_with"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
        },
        {
          label: t("environments.surveys.edit.ends_with"),
          value: ZSurveyLogicConditionsOperator.Enum.endsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_end_with"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
        },
      ],
    },
    ["variable.number"]: {
      options: [
        {
          label: "=",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "!=",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: ">",
          value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan,
        },
        {
          label: "<",
          value: ZSurveyLogicConditionsOperator.Enum.isLessThan,
        },
        {
          label: ">=",
          value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual,
        },
        {
          label: "<=",
          value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual,
        },
      ],
    },
    hiddenField: {
      options: [
        {
          label: t("environments.surveys.edit.equals"),
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: t("environments.surveys.edit.does_not_equal"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: t("environments.surveys.edit.contains"),
          value: ZSurveyLogicConditionsOperator.Enum.contains,
        },
        {
          label: t("environments.surveys.edit.does_not_contain"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
        },
        {
          label: t("environments.surveys.edit.starts_with"),
          value: ZSurveyLogicConditionsOperator.Enum.startsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_start_with"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
        },
        {
          label: t("environments.surveys.edit.ends_with"),
          value: ZSurveyLogicConditionsOperator.Enum.endsWith,
        },
        {
          label: t("environments.surveys.edit.does_not_end_with"),
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
        },
        {
          label: t("environments.surveys.edit.is_set"),
          value: ZSurveyLogicConditionsOperator.Enum.isSet,
        },
        {
          label: t("environments.surveys.edit.is_not_set"),
          value: ZSurveyLogicConditionsOperator.Enum.isNotSet,
        },
      ],
    },
  };
};

export type TLogicRuleOption = ReturnType<typeof getLogicRules>["question"][keyof ReturnType<
  typeof getLogicRules
>["question"]]["options"];
