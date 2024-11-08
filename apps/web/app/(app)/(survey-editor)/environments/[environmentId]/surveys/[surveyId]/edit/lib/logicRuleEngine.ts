import { TSurveyQuestionTypeEnum, ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/types";

export const logicRules = {
  question: {
    [`${TSurveyQuestionTypeEnum.OpenText}.text`]: {
      options: [
        {
          label: "environments.surveys.edit.equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "environments.surveys.edit.does_not_equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "environments.surveys.edit.contains",
          value: ZSurveyLogicConditionsOperator.Enum.contains,
        },
        {
          label: "environments.surveys.edit.does_not_contain",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
        },
        {
          label: "environments.surveys.edit.starts_with",
          value: ZSurveyLogicConditionsOperator.Enum.startsWith,
        },
        {
          label: "environments.surveys.edit.does_not_start_with",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
        },
        {
          label: "environments.surveys.edit.ends_with",
          value: ZSurveyLogicConditionsOperator.Enum.endsWith,
        },
        {
          label: "environments.surveys.edit.does_not_end_with",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
        },
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
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
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: {
      options: [
        {
          label: "environments.surveys.edit.equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "environments.surveys.edit.does_not_equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "environments.surveys.edit.equals_one_of",
          value: ZSurveyLogicConditionsOperator.Enum.equalsOneOf,
        },
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: {
      options: [
        {
          label: "environments.surveys.edit.equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "environments.surveys.edit.does_not_equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "environments.surveys.edit.includes_all_of",
          value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
        },
        {
          label: "environments.surveys.edit.includes_one_of",
          value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
        },
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.PictureSelection]: {
      options: [
        {
          label: "environments.surveys.edit.equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "environments.surveys.edit.does_not_equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "environments.surveys.edit.includes_all_of",
          value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
        },
        {
          label: "environments.surveys.edit.includes_one_of",
          value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
        },
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
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
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
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
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.CTA]: {
      options: [
        {
          label: "environments.surveys.edit.is_clicked",
          value: ZSurveyLogicConditionsOperator.Enum.isClicked,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Consent]: {
      options: [
        {
          label: "environments.surveys.edit.is_accepted",
          value: ZSurveyLogicConditionsOperator.Enum.isAccepted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Date]: {
      options: [
        {
          label: "environments.surveys.edit.e quals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "environments.surveys.edit.does_not_equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "environments.surveys.edit.is_before",
          value: ZSurveyLogicConditionsOperator.Enum.isBefore,
        },
        {
          label: "environments.surveys.edit.is_after",
          value: ZSurveyLogicConditionsOperator.Enum.isAfter,
        },
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.FileUpload]: {
      options: [
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Ranking]: {
      options: [
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Cal]: {
      options: [
        {
          label: "environments.surveys.edit.is_booked",
          value: ZSurveyLogicConditionsOperator.Enum.isBooked,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Matrix]: {
      options: [
        {
          label: "environments.surveys.edit.is_partially_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
        },
        {
          label: "environments.surveys.edit.is_completely_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Address]: {
      options: [
        {
          label: "environments.surveys.edit.is_submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "environments.surveys.edit.is_skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
  },
  ["variable.text"]: {
    options: [
      {
        label: "environments.surveys.edit.equals",
        value: ZSurveyLogicConditionsOperator.Enum.equals,
      },
      {
        label: "environments.surveys.edit.does_not_equal",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
      },
      {
        label: "environments.surveys.edit.contains",
        value: ZSurveyLogicConditionsOperator.Enum.contains,
      },
      {
        label: "environments.surveys.edit.does_not_contain",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
      },
      {
        label: "environments.surveys.edit.starts_with",
        value: ZSurveyLogicConditionsOperator.Enum.startsWith,
      },
      {
        label: "environments.surveys.edit.does_not_start_with",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
      },
      {
        label: "environments.surveys.edit.ends_with",
        value: ZSurveyLogicConditionsOperator.Enum.endsWith,
      },
      {
        label: "environments.surveys.edit.does_not_end_with",
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
        label: "environments.surveys.edit.equals",
        value: ZSurveyLogicConditionsOperator.Enum.equals,
      },
      {
        label: "environments.surveys.edit.does_not_equal",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
      },
      {
        label: "environments.surveys.edit.contains",
        value: ZSurveyLogicConditionsOperator.Enum.contains,
      },
      {
        label: "environments.surveys.edit.does_not_contain",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
      },
      {
        label: "environments.surveys.edit.starts_with",
        value: ZSurveyLogicConditionsOperator.Enum.startsWith,
      },
      {
        label: "environments.surveys.edit.does_not_start_with",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
      },
      {
        label: "environments.surveys.edit.ends_with",
        value: ZSurveyLogicConditionsOperator.Enum.endsWith,
      },
      {
        label: "environments.surveys.edit.does_not_end_with",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
      },
    ],
  },
};

export type TLogicRuleOption = (typeof logicRules.question)[keyof typeof logicRules.question]["options"];
