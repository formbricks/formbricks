import { EyeOffIcon, FileDigitIcon, FileType2Icon } from "lucide-react";
import { HTMLInputTypeAttribute } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { isConditionGroup } from "@formbricks/lib/surveyLogic/utils";
import { questionTypes } from "@formbricks/lib/utils/questions";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TConditionGroup,
  TLeftOperand,
  TRightOperand,
  TSingleCondition,
  TSurvey,
  TSurveyLogic,
  TSurveyLogicAction,
  TSurveyLogicConditionsOperator,
  TSurveyQuestion,
  TSurveyQuestionId,
  TSurveyQuestionTypeEnum,
  TSurveyVariable,
} from "@formbricks/types/surveys/types";
import { TComboboxGroupedOption, TComboboxOption } from "@formbricks/ui/components/InputCombobox";
import { TLogicRuleOption, logicRules } from "./logicRuleEngine";

// formats the text to highlight specific parts of the text with slashes
export const formatTextWithSlashes = (text: string) => {
  const regex = /\/(.*?)\\/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    // Check if the part was inside slashes
    if (index % 2 !== 0) {
      return (
        <span key={index} className="mx-1 rounded-md bg-slate-100 p-1 px-2 text-xs">
          {part}
        </span>
      );
    } else {
      return part;
    }
  });
};

const questionIconMapping = questionTypes.reduce(
  (prev, curr) => ({
    ...prev,
    [curr.id]: curr.icon,
  }),
  {}
);

export const getConditionValueOptions = (
  localSurvey: TSurvey,
  currQuestionIdx: number
): TComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds ?? [];
  const variables = localSurvey.variables ?? [];
  const questions = localSurvey.questions;

  const groupedOptions: TComboboxGroupedOption[] = [];
  const questionOptions = questions
    .filter((_, idx) => idx <= currQuestionIdx)
    .map((question) => {
      return {
        icon: questionIconMapping[question.type],
        label: getLocalizedValue(question.headline, "default"),
        value: question.id,
        meta: {
          type: "question",
        },
      };
    });

  const variableOptions = variables.map((variable) => {
    return {
      icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
      label: variable.name,
      value: variable.id,
      meta: {
        type: "variable",
      },
    };
  });

  const hiddenFieldsOptions = hiddenFields.map((field) => {
    return {
      icon: EyeOffIcon,
      label: field,
      value: field,
      meta: {
        type: "hiddenField",
      },
    };
  });

  if (questionOptions.length > 0) {
    groupedOptions.push({
      label: "Questions",
      value: "questions",
      options: questionOptions,
    });
  }

  if (variableOptions.length > 0) {
    groupedOptions.push({
      label: "Variables",
      value: "variables",
      options: variableOptions,
    });
  }

  if (hiddenFieldsOptions.length > 0) {
    groupedOptions.push({
      label: "Hidden Fields",
      value: "hiddenFields",
      options: hiddenFieldsOptions,
    });
  }

  return groupedOptions;
};

export const replaceEndingCardHeadlineRecall = (
  survey: TSurvey,
  language: string,
  attributeClasses: TAttributeClass[]
) => {
  const modifiedSurvey = structuredClone(survey);
  modifiedSurvey.endings.forEach((ending) => {
    if (ending.type === "endScreen") {
      ending.headline = recallToHeadline(
        ending.headline || {},
        modifiedSurvey,
        false,
        language,
        attributeClasses
      );
    }
  });
  return modifiedSurvey;
};

export const actionObjectiveOptions: TComboboxOption[] = [
  { label: "Calculate", value: "calculate" },
  { label: "Require Answer", value: "requireAnswer" },
  { label: "Jump to question", value: "jumpToQuestion" },
];

const getQuestionOperatorOptions = (question: TSurveyQuestion): TComboboxOption[] => {
  let options: TLogicRuleOption;

  if (question.type === "openText") {
    const inputType = question.inputType === "number" ? "number" : "text";
    options = logicRules.question[`openText.${inputType}`].options;
  } else {
    options = logicRules.question[question.type].options;
  }

  if (question.required) {
    options = options.filter((option) => option.value !== "isSkipped") as TLogicRuleOption;
  }

  return options;
};

export const getDefaultOperatorForQuestion = (question: TSurveyQuestion): TSurveyLogicConditionsOperator => {
  const options = getQuestionOperatorOptions(question);

  return options[0].value.toString() as TSurveyLogicConditionsOperator;
};

export const getConditionOperatorOptions = (
  condition: TSingleCondition,
  localSurvey: TSurvey
): TComboboxOption[] => {
  if (condition.leftOperand.type === "variable") {
    const variables = localSurvey.variables ?? [];
    const variableType =
      variables.find((variable) => variable.id === condition.leftOperand.value)?.type || "text";
    return logicRules[`variable.${variableType}`].options;
  } else if (condition.leftOperand.type === "hiddenField") {
    return logicRules.hiddenField.options;
  } else if (condition.leftOperand.type === "question") {
    const questions = localSurvey.questions ?? [];
    const question = questions.find((question) => question.id === condition.leftOperand.value);

    if (!question) return [];

    return getQuestionOperatorOptions(question);
  }
  return [];
};

export const getMatchValueProps = (
  condition: TSingleCondition,
  localSurvey: TSurvey
): {
  show?: boolean;
  showInput?: boolean;
  inputType?: HTMLInputTypeAttribute;
  options: TComboboxGroupedOption[];
} => {
  if (
    [
      "isAccepted",
      "isBooked",
      "isClicked",
      "isCompletelySubmitted",
      "isPartiallySubmitted",
      "isSkipped",
      "isSubmitted",
    ].includes(condition.operator)
  ) {
    return { show: false, options: [] };
  }

  let questions = localSurvey.questions ?? [];
  let variables = localSurvey.variables ?? [];
  let hiddenFields = localSurvey.hiddenFields?.fieldIds ?? [];

  const selectedQuestion = questions.find((question) => question.id === condition.leftOperand.value);
  const selectedVariable = variables.find((variable) => variable.id === condition.leftOperand.value);

  if (condition.leftOperand.type === "question") {
    questions = questions.filter((question) => question.id !== condition.leftOperand.value);
  } else if (condition.leftOperand.type === "variable") {
    variables = variables.filter((variable) => variable.id !== condition.leftOperand.value);
  } else if (condition.leftOperand.type === "hiddenField") {
    hiddenFields = hiddenFields.filter((field) => field !== condition.leftOperand.value);
  }

  if (condition.leftOperand.type === "question") {
    if (selectedQuestion?.type === TSurveyQuestionTypeEnum.OpenText) {
      const allowedQuestionTypes = [TSurveyQuestionTypeEnum.OpenText];

      if (selectedQuestion.inputType === "number") {
        allowedQuestionTypes.push(TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS);
      }

      if (["equals", "doesNotEqual"].includes(condition.operator)) {
        if (selectedQuestion.inputType !== "number") {
          allowedQuestionTypes.push(
            TSurveyQuestionTypeEnum.Date,
            TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            TSurveyQuestionTypeEnum.MultipleChoiceMulti
          );
        }
      }

      const allowedQuestions = questions.filter((question) => allowedQuestionTypes.includes(question.type));

      const questionOptions = allowedQuestions.map((question) => {
        return {
          icon: questionIconMapping[question.type],
          label: getLocalizedValue(question.headline, "default"),
          value: question.id,
          meta: {
            type: "question",
          },
        };
      });

      const variableOptions = variables
        .filter((variable) =>
          selectedQuestion.inputType !== "number" ? variable.type === "text" : variable.type === "number"
        )
        .map((variable) => {
          return {
            icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
            label: variable.name,
            value: variable.id,
            meta: {
              type: "variable",
            },
          };
        });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (questionOptions.length > 0) {
        groupedOptions.push({
          label: "Questions",
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: "Variables",
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: "Hidden Fields",
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }
      return {
        show: true,
        showInput: true,
        inputType: selectedQuestion.inputType === "number" ? "number" : "text",
        options: groupedOptions,
      };
    } else if (
      selectedQuestion?.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
      selectedQuestion?.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
    ) {
      const choices = selectedQuestion.choices.map((choice) => {
        return {
          label: getLocalizedValue(choice.label, "default"),
          value: choice.id,
          meta: {
            type: "static",
          },
        };
      });

      return {
        show: true,
        showInput: false,
        options: [{ label: "Choices", value: "choices", options: choices }],
      };
    } else if (selectedQuestion?.type === TSurveyQuestionTypeEnum.PictureSelection) {
      const choices = selectedQuestion.choices.map((choice, idx) => {
        return {
          imgSrc: choice.imageUrl,
          label: `Picture ${idx + 1}`,
          value: choice.id,
          meta: {
            type: "static",
          },
        };
      });

      return {
        show: true,
        showInput: false,
        options: [{ label: "Choices", value: "choices", options: choices }],
      };
    } else if (selectedQuestion?.type === TSurveyQuestionTypeEnum.Rating) {
      const choices = Array.from({ length: selectedQuestion.range }, (_, idx) => {
        return {
          label: `${idx + 1}`,
          value: idx + 1,
          meta: {
            type: "static",
          },
        };
      });

      const numberVariables = variables.filter((variable) => variable.type === "number");

      const variableOptions = numberVariables.map((variable) => {
        return {
          icon: FileDigitIcon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (choices.length > 0) {
        groupedOptions.push({
          label: "Choices",
          value: "choices",
          options: choices,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: "Variables",
          value: "variables",
          options: variableOptions,
        });
      }

      return {
        show: true,
        showInput: false,
        options: groupedOptions,
      };
    } else if (selectedQuestion?.type === TSurveyQuestionTypeEnum.NPS) {
      const choices = Array.from({ length: 11 }, (_, idx) => {
        return {
          label: `${idx}`,
          value: idx,
          meta: {
            type: "static",
          },
        };
      });

      const numberVariables = variables.filter((variable) => variable.type === "number");

      const variableOptions = numberVariables.map((variable) => {
        return {
          icon: FileDigitIcon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (choices.length > 0) {
        groupedOptions.push({
          label: "Choices",
          value: "choices",
          options: choices,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: "Variables",
          value: "variables",
          options: variableOptions,
        });
      }

      return {
        show: true,
        showInput: false,
        options: groupedOptions,
      };
    } else if (selectedQuestion?.type === TSurveyQuestionTypeEnum.Date) {
      const openTextQuestions = questions.filter((question) =>
        [TSurveyQuestionTypeEnum.OpenText, TSurveyQuestionTypeEnum.Date].includes(question.type)
      );

      const questionOptions = openTextQuestions.map((question) => {
        return {
          icon: questionIconMapping[question.type],
          label: getLocalizedValue(question.headline, "default"),
          value: question.id,
          meta: {
            type: "question",
          },
        };
      });

      const stringVariables = variables.filter((variable) => variable.type === "text");

      const variableOptions = stringVariables.map((variable) => {
        return {
          icon: FileType2Icon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (questionOptions.length > 0) {
        groupedOptions.push({
          label: "Questions",
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: "Variables",
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: "Hidden Fields",
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }

      return {
        show: true,
        showInput: true,
        inputType: "date",
        options: groupedOptions,
      };
    }
  } else if (condition.leftOperand.type === "variable") {
    if (selectedVariable?.type === "text") {
      const allowedQuestionTypes = [
        TSurveyQuestionTypeEnum.OpenText,
        TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      ];

      if (["equals", "doesNotEqual"].includes(condition.operator)) {
        allowedQuestionTypes.push(TSurveyQuestionTypeEnum.MultipleChoiceMulti, TSurveyQuestionTypeEnum.Date);
      }

      const allowedQuestions = questions.filter((question) => allowedQuestionTypes.includes(question.type));

      const questionOptions = allowedQuestions.map((question) => {
        return {
          icon: questionIconMapping[question.type],
          label: getLocalizedValue(question.headline, "default"),
          value: question.id,
          meta: {
            type: "question",
          },
        };
      });

      const stringVariables = variables.filter((variable) => variable.type === "text");

      const variableOptions = stringVariables.map((variable) => {
        return {
          icon: FileType2Icon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (questionOptions.length > 0) {
        groupedOptions.push({
          label: "Questions",
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: "Variables",
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: "Hidden Fields",
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }

      return {
        show: true,
        showInput: true,
        inputType: "text",
        options: groupedOptions,
      };
    } else if (selectedVariable?.type === "number") {
      const allowedQuestions = questions.filter((question) =>
        [TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS].includes(question.type)
      );

      const questionOptions = allowedQuestions.map((question) => {
        return {
          icon: questionIconMapping[question.type],
          label: getLocalizedValue(question.headline, "default"),
          value: question.id,
          meta: {
            type: "question",
          },
        };
      });

      const numberVariables = variables.filter((variable) => variable.type === "number");

      const variableOptions = numberVariables.map((variable) => {
        return {
          icon: FileDigitIcon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

      const hiddenFieldsOptions = hiddenFields.map((field) => {
        return {
          icon: EyeOffIcon,
          label: field,
          value: field,
          meta: {
            type: "hiddenField",
          },
        };
      });

      const groupedOptions: TComboboxGroupedOption[] = [];

      if (questionOptions.length > 0) {
        groupedOptions.push({
          label: "Questions",
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: "Variables",
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: "Hidden Fields",
          value: "hiddenFields",
          options: hiddenFieldsOptions,
        });
      }

      return {
        show: true,
        showInput: true,
        inputType: "number",
        options: groupedOptions,
      };
    }
  } else if (condition.leftOperand.type === "hiddenField") {
    const allowedQuestionTypes = [
      TSurveyQuestionTypeEnum.OpenText,
      TSurveyQuestionTypeEnum.MultipleChoiceSingle,
    ];

    if (["equals", "doesNotEqual"].includes(condition.operator)) {
      allowedQuestionTypes.push(TSurveyQuestionTypeEnum.MultipleChoiceMulti, TSurveyQuestionTypeEnum.Date);
    }

    const allowedQuestions = questions.filter((question) => allowedQuestionTypes.includes(question.type));

    const questionOptions = allowedQuestions.map((question) => {
      return {
        icon: questionIconMapping[question.type],
        label: getLocalizedValue(question.headline, "default"),
        value: question.id,
        meta: {
          type: "question",
        },
      };
    });

    const variableOptions = variables
      .filter((variable) => variable.type === "text")
      .map((variable) => {
        return {
          icon: FileType2Icon,
          label: variable.name,
          value: variable.id,
          meta: {
            type: "variable",
          },
        };
      });

    const hiddenFieldsOptions = hiddenFields.map((field) => {
      return {
        icon: EyeOffIcon,
        label: field,
        value: field,
        meta: {
          type: "hiddenField",
        },
      };
    });

    const groupedOptions: TComboboxGroupedOption[] = [];

    if (questionOptions.length > 0) {
      groupedOptions.push({
        label: "Questions",
        value: "questions",
        options: questionOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: "Variables",
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: "Hidden Fields",
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    return {
      show: true,
      showInput: true,
      inputType: "text",
      options: groupedOptions,
    };
  }

  return { show: false, options: [] };
};

export const getActionTargetOptions = (
  action: TSurveyLogicAction,
  localSurvey: TSurvey,
  currQuestionIdx: number
): TComboboxOption[] => {
  let questions = localSurvey.questions.filter((_, idx) => idx !== currQuestionIdx);

  if (action.objective === "requireAnswer") {
    questions = questions.filter((question) => !question.required);
  }

  const questionOptions = questions.map((question) => {
    return {
      icon: questionIconMapping[question.type],
      label: getLocalizedValue(question.headline, "default"),
      value: question.id,
    };
  });

  if (action.objective === "requireAnswer") return questionOptions;

  const endingCardOptions = localSurvey.endings.map((ending) => {
    return {
      label:
        ending.type === "endScreen"
          ? getLocalizedValue(ending.headline, "default") || "End Screen"
          : ending.label || "Redirect Thank you card",
      value: ending.id,
    };
  });

  return [...questionOptions, ...endingCardOptions];
};

export const getActionVariableOptions = (localSurvey: TSurvey): TComboboxOption[] => {
  const variables = localSurvey.variables ?? [];

  return variables.map((variable) => {
    return {
      icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
      label: variable.name,
      value: variable.id,
      meta: {
        variableType: variable.type,
      },
    };
  });
};

export const getActionOperatorOptions = (variableType?: TSurveyVariable["type"]): TComboboxOption[] => {
  if (variableType === "number") {
    return [
      {
        label: "Add +",
        value: "add",
      },
      {
        label: "Subtract -",
        value: "subtract",
      },
      {
        label: "Multiply *",
        value: "multiply",
      },
      {
        label: "Divide /",
        value: "divide",
      },
      {
        label: "Assign =",
        value: "assign",
      },
    ];
  } else if (variableType === "text") {
    return [
      {
        label: "Assign =",
        value: "assign",
      },
      {
        label: "Concat +",
        value: "concat",
      },
    ];
  }
  return [];
};

export const getActionValueOptions = (variableId: string, localSurvey: TSurvey): TComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds ?? [];
  let variables = localSurvey.variables ?? [];
  const questions = localSurvey.questions;

  const hiddenFieldsOptions = hiddenFields.map((field) => {
    return {
      icon: EyeOffIcon,
      label: field,
      value: field,
      meta: {
        type: "hiddenField",
      },
    };
  });

  const selectedVariable = variables.find((variable) => variable.id === variableId);

  variables = variables.filter((variable) => variable.id !== variableId);

  if (!selectedVariable) return [];

  if (selectedVariable.type === "text") {
    const allowedQuestions = questions.filter((question) =>
      [
        TSurveyQuestionTypeEnum.OpenText,
        TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        TSurveyQuestionTypeEnum.Rating,
        TSurveyQuestionTypeEnum.NPS,
        TSurveyQuestionTypeEnum.Date,
      ].includes(question.type)
    );

    const questionOptions = allowedQuestions.map((question) => {
      return {
        icon: questionIconMapping[question.type],
        label: getLocalizedValue(question.headline, "default"),
        value: question.id,
        meta: {
          type: "question",
        },
      };
    });

    const stringVariables = variables.filter((variable) => variable.type === "text");

    const variableOptions = stringVariables.map((variable) => {
      return {
        icon: FileType2Icon,
        label: variable.name,
        value: variable.id,
        meta: {
          type: "variable",
        },
      };
    });

    const groupedOptions: TComboboxGroupedOption[] = [];

    if (questionOptions.length > 0) {
      groupedOptions.push({
        label: "Questions",
        value: "questions",
        options: questionOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: "Variables",
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: "Hidden Fields",
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    return groupedOptions;
  } else if (selectedVariable.type === "number") {
    const allowedQuestions = questions.filter((question) =>
      [TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS].includes(question.type)
    );

    const questionOptions = allowedQuestions.map((question) => {
      return {
        icon: questionIconMapping[question.type],
        label: getLocalizedValue(question.headline, "default"),
        value: question.id,
        meta: {
          type: "question",
        },
      };
    });

    const numberVariables = variables.filter((variable) => variable.type === "number");

    const variableOptions = numberVariables.map((variable) => {
      return {
        icon: FileDigitIcon,
        label: variable.name,
        value: variable.id,
        meta: {
          type: "variable",
        },
      };
    });

    const groupedOptions: TComboboxGroupedOption[] = [];

    if (questionOptions.length > 0) {
      groupedOptions.push({
        label: "Questions",
        value: "questions",
        options: questionOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: "Variables",
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: "Hidden Fields",
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    return groupedOptions;
  }

  return [];
};

const isUsedInLeftOperand = (
  leftOperand: TLeftOperand,
  type: "question" | "hiddenField" | "variable",
  id: string
): boolean => {
  switch (type) {
    case "question":
      return leftOperand.type === "question" && leftOperand.value === id;
    case "hiddenField":
      return leftOperand.type === "hiddenField" && leftOperand.value === id;
    case "variable":
      return leftOperand.type === "variable" && leftOperand.value === id;
    default:
      return false;
  }
};

const isUsedInRightOperand = (
  rightOperand: TRightOperand,
  type: "question" | "hiddenField" | "variable",
  id: string
): boolean => {
  switch (type) {
    case "question":
      return rightOperand.type === "question" && rightOperand.value === id;
    case "hiddenField":
      return rightOperand.type === "hiddenField" && rightOperand.value === id;
    case "variable":
      return rightOperand.type === "variable" && rightOperand.value === id;
    default:
      return false;
  }
};

export const findQuestionUsedInLogic = (survey: TSurvey, questionId: TSurveyQuestionId): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand, "question", questionId)) ||
        isUsedInLeftOperand(condition.leftOperand, "question", questionId)
      );
    }
  };

  const isUsedInAction = (action: TSurveyLogicAction): boolean => {
    return (
      (action.objective === "jumpToQuestion" && action.target === questionId) ||
      (action.objective === "requireAnswer" && action.target === questionId)
    );
  };

  const isUsedInLogicRule = (logicRule: TSurveyLogic): boolean => {
    return isUsedInCondition(logicRule.conditions) || logicRule.actions.some(isUsedInAction);
  };

  return survey.questions.findIndex(
    (question) => question.logic && question.id !== questionId && question.logic.some(isUsedInLogicRule)
  );
};

export const findOptionUsedInLogic = (
  survey: TSurvey,
  questionId: TSurveyQuestionId,
  optionId: string
): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return isUsedInOperand(condition);
    }
  };

  const isUsedInOperand = (condition: TSingleCondition): boolean => {
    if (condition.leftOperand.type === "question" && condition.leftOperand.value === questionId) {
      if (condition.rightOperand && condition.rightOperand.type === "static") {
        if (Array.isArray(condition.rightOperand.value)) {
          return condition.rightOperand.value.includes(optionId);
        } else {
          return condition.rightOperand.value === optionId;
        }
      }
    }
    return false;
  };

  const isUsedInLogicRule = (logicRule: TSurveyLogic): boolean => {
    return isUsedInCondition(logicRule.conditions);
  };

  return survey.questions.findIndex((question) => question.logic?.some(isUsedInLogicRule));
};

export const findVariableUsedInLogic = (survey: TSurvey, variableId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand, "variable", variableId)) ||
        isUsedInLeftOperand(condition.leftOperand, "variable", variableId)
      );
    }
  };

  const isUsedInAction = (action: TSurveyLogicAction): boolean => {
    return action.objective === "calculate" && action.variableId === variableId;
  };

  const isUsedInLogicRule = (logicRule: TSurveyLogic): boolean => {
    return isUsedInCondition(logicRule.conditions) || logicRule.actions.some(isUsedInAction);
  };

  return survey.questions.findIndex((question) => question.logic?.some(isUsedInLogicRule));
};

export const findHiddenFieldUsedInLogic = (survey: TSurvey, hiddenFieldId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand &&
          isUsedInRightOperand(condition.rightOperand, "hiddenField", hiddenFieldId)) ||
        isUsedInLeftOperand(condition.leftOperand, "hiddenField", hiddenFieldId)
      );
    }
  };

  const isUsedInLogicRule = (logicRule: TSurveyLogic): boolean => {
    return isUsedInCondition(logicRule.conditions);
  };

  return survey.questions.findIndex((question) => question.logic?.some(isUsedInLogicRule));
};
