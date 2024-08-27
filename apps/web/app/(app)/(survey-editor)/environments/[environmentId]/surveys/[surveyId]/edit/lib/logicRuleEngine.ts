import { ZSurveyLogicCondition } from "@formbricks/types/surveys/logic";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const ruleEngine = {
  question: {
    [TSurveyQuestionTypeEnum.OpenText]: {
      text: {
        options: [
          {
            label: "equals",
            value: ZSurveyLogicCondition.Enum.equals,
          },
          {
            label: "does not equal",
            value: ZSurveyLogicCondition.Enum.doesNotEqual,
          },
          {
            label: "contains",
            value: ZSurveyLogicCondition.Enum.contains,
          },
          {
            label: "does not contain",
            value: ZSurveyLogicCondition.Enum.doesNotContain,
          },
          {
            label: "starts with",
            value: ZSurveyLogicCondition.Enum.startsWith,
          },
          {
            label: "does not start with",
            value: ZSurveyLogicCondition.Enum.doesNotStartWith,
          },
          {
            label: "ends with",
            value: ZSurveyLogicCondition.Enum.endsWith,
          },
          {
            label: "does not end with",
            value: ZSurveyLogicCondition.Enum.doesNotEndWith,
          },
          {
            label: "is submitted",
            value: ZSurveyLogicCondition.Enum.isSubmitted,
          },
          {
            label: "is skipped",
            value: ZSurveyLogicCondition.Enum.isSkipped,
          },
        ],
      },
      number: {
        options: [
          {
            label: "=",
            value: ZSurveyLogicCondition.Enum.equals,
          },
          {
            label: "!=",
            value: ZSurveyLogicCondition.Enum.doesNotEqual,
          },
          {
            label: ">",
            value: ZSurveyLogicCondition.Enum.isGreaterThan,
          },
          {
            label: "<",
            value: ZSurveyLogicCondition.Enum.isLessThan,
          },
          {
            label: ">=",
            value: ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
          },
          {
            label: "<=",
            value: ZSurveyLogicCondition.Enum.isLessThanOrEqual,
          },
          {
            label: "is submitted",
            value: ZSurveyLogicCondition.Enum.isSubmitted,
          },
          {
            label: "is skipped",
            value: ZSurveyLogicCondition.Enum.isSkipped,
          },
        ],
      },
    },
    [TSurveyQuestionTypeEnum.MultipleChoiceSingle]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
        {
          label: "equals one of",
          value: ZSurveyLogicCondition.Enum.equalsOneOf,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.MultipleChoiceMulti]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
        {
          label: "includes all of",
          value: ZSurveyLogicCondition.Enum.includesAllOf,
        },
        {
          label: "includes one of",
          value: ZSurveyLogicCondition.Enum.includesOneOf,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.PictureSelection]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
        {
          label: "includes all of",
          value: ZSurveyLogicCondition.Enum.includesAllOf,
        },
        {
          label: "includes one of",
          value: ZSurveyLogicCondition.Enum.includesOneOf,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Rating]: {
      options: [
        {
          label: "=",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "!=",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
        {
          label: ">",
          value: ZSurveyLogicCondition.Enum.isGreaterThan,
        },
        {
          label: "<",
          value: ZSurveyLogicCondition.Enum.isLessThan,
        },
        {
          label: ">=",
          value: ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
        },
        {
          label: "<=",
          value: ZSurveyLogicCondition.Enum.isLessThanOrEqual,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.NPS]: {
      options: [
        {
          label: "=",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "!=",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
        {
          label: ">",
          value: ZSurveyLogicCondition.Enum.isGreaterThan,
        },
        {
          label: "<",
          value: ZSurveyLogicCondition.Enum.isLessThan,
        },
        {
          label: ">=",
          value: ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
        },
        {
          label: "<=",
          value: ZSurveyLogicCondition.Enum.isLessThanOrEqual,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.CTA]: {
      options: [
        {
          label: "is clicked",
          value: ZSurveyLogicCondition.Enum.isClicked,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Consent]: {
      options: [
        {
          label: "is accepted",
          value: ZSurveyLogicCondition.Enum.isAccepted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Date]: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
        {
          label: "is before",
          value: ZSurveyLogicCondition.Enum.isBefore,
        },
        {
          label: "is after",
          value: ZSurveyLogicCondition.Enum.isAfter,
        },
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.FileUpload]: {
      options: [
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Cal]: {
      options: [
        {
          label: "is booked",
          value: ZSurveyLogicCondition.Enum.isBooked,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Matrix]: {
      options: [
        {
          label: "is partially submitted",
          value: ZSurveyLogicCondition.Enum.isPartiallySubmitted,
        },
        {
          label: "is completely submitted",
          value: ZSurveyLogicCondition.Enum.isCompletelySubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
    [TSurveyQuestionTypeEnum.Address]: {
      options: [
        {
          label: "is submitted",
          value: ZSurveyLogicCondition.Enum.isSubmitted,
        },
        {
          label: "is skipped",
          value: ZSurveyLogicCondition.Enum.isSkipped,
        },
      ],
    },
  },
  variable: {
    text: {
      options: [
        {
          label: "equals",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "does not equal",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
      ],
    },
    number: {
      options: [
        {
          label: "=",
          value: ZSurveyLogicCondition.Enum.equals,
        },
        {
          label: "!=",
          value: ZSurveyLogicCondition.Enum.doesNotEqual,
        },
        {
          label: ">",
          value: ZSurveyLogicCondition.Enum.isGreaterThan,
        },
        {
          label: "<",
          value: ZSurveyLogicCondition.Enum.isLessThan,
        },
        {
          label: ">=",
          value: ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
        },
        {
          label: "<=",
          value: ZSurveyLogicCondition.Enum.isLessThanOrEqual,
        },
      ],
    },
  },
  hiddenField: {
    options: [
      {
        label: "equals",
        value: ZSurveyLogicCondition.Enum.equals,
      },
      {
        label: "does not equal",
        value: ZSurveyLogicCondition.Enum.doesNotEqual,
      },
    ],
  },
};
