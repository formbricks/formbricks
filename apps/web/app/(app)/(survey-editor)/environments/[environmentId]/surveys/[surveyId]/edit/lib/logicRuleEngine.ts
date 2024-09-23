import { TSurveyQuestionTypeEnum, ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/types";

export const logicRules = {
  question: {
    [`${TSurveyQuestionTypeEnum.OpenText}.text`]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "contains",
          value: ZSurveyLogicConditionsOperator.Enum.contains,
        },
        {
          label: "does not contain",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
        },
        {
          label: "starts with",
          value: ZSurveyLogicConditionsOperator.Enum.startsWith,
        },
        {
          label: "does not start with",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
        },
        {
          label: "ends with",
          value: ZSurveyLogicConditionsOperator.Enum.endsWith,
        },
        {
          label: "does not end with",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
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
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "equals one of",
          value: ZSurveyLogicConditionsOperator.Enum.equalsOneOf,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "includes all of",
          value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
        },
        {
          label: "includes one of",
          value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.PictureSelection]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "includes all of",
          value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
        },
        {
          label: "includes one of",
          value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
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
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
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
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.CTA]: {
      options: [
        {
          label: "is clicked",
          value: ZSurveyLogicConditionsOperator.Enum.isClicked,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Consent]: {
      options: [
        {
          label: "is accepted",
          value: ZSurveyLogicConditionsOperator.Enum.isAccepted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Date]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "is before",
          value: ZSurveyLogicConditionsOperator.Enum.isBefore,
        },
        {
          label: "is after",
          value: ZSurveyLogicConditionsOperator.Enum.isAfter,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.FileUpload]: {
      options: [
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Ranking]: {
      options: [
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Cal]: {
      options: [
        {
          label: "is booked",
          value: ZSurveyLogicConditionsOperator.Enum.isBooked,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Matrix]: {
      options: [
        {
          label: "is partially submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
        },
        {
          label: "is completely submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Address]: {
      options: [
        {
          label: "is submitted",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ],
    },
  },
  ["variable.text"]: {
    options: [
      {
        label: "equals",
        value: ZSurveyLogicConditionsOperator.Enum.equals,
      },
      {
        label: "does not equal",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
      },
      {
        label: "contains",
        value: ZSurveyLogicConditionsOperator.Enum.contains,
      },
      {
        label: "does not contain",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
      },
      {
        label: "starts with",
        value: ZSurveyLogicConditionsOperator.Enum.startsWith,
      },
      {
        label: "does not start with",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
      },
      {
        label: "ends with",
        value: ZSurveyLogicConditionsOperator.Enum.endsWith,
      },
      {
        label: "does not end with",
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
        label: "equals",
        value: ZSurveyLogicConditionsOperator.Enum.equals,
      },
      {
        label: "does not equal",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
      },
      {
        label: "contains",
        value: ZSurveyLogicConditionsOperator.Enum.contains,
      },
      {
        label: "does not contain",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
      },
      {
        label: "starts with",
        value: ZSurveyLogicConditionsOperator.Enum.startsWith,
      },
      {
        label: "does not start with",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
      },
      {
        label: "ends with",
        value: ZSurveyLogicConditionsOperator.Enum.endsWith,
      },
      {
        label: "does not end with",
        value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
      },
    ],
  },
};

export type TLogicRuleOption = (typeof logicRules.question)[keyof typeof logicRules.question]["options"];
