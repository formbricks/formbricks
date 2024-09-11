import { ruleEngine } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/lib/logicRuleEngine";
import {
  ArrowUpFromLineIcon,
  CalendarDaysIcon,
  CheckIcon,
  EyeOffIcon,
  FileDigitIcon,
  FileType2Icon,
  Grid3X3Icon,
  HomeIcon,
  ImageIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  MousePointerClickIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  StarIcon,
} from "lucide-react";
import { HTMLInputTypeAttribute } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { isConditionsGroup } from "@formbricks/lib/survey/logic/utils";
import {
  TAction,
  TConditionGroup,
  TLeftOperand,
  TRightOperand,
  TSingleCondition,
  TSurveyAdvancedLogic,
} from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestionTypeEnum, TSurveyVariable } from "@formbricks/types/surveys/types";
import { TComboboxGroupedOption, TComboboxOption } from "@formbricks/ui/InputCombobox";

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

const questionIconMapping = {
  openText: MessageSquareTextIcon,
  multipleChoiceSingle: Rows3Icon,
  multipleChoiceMulti: ListIcon,
  pictureSelection: ImageIcon,
  rating: StarIcon,
  nps: PresentationIcon,
  cta: MousePointerClickIcon,
  consent: CheckIcon,
  date: CalendarDaysIcon,
  fileUpload: ArrowUpFromLineIcon,
  cal: PhoneIcon,
  matrix: Grid3X3Icon,
  ranking: ListOrderedIcon,
  address: HomeIcon,
};

export const getConditionValueOptions = (
  localSurvey: TSurvey,
  currQuestionIdx: number
): TComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds || [];
  const variables = localSurvey.variables || [];
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

export const actionObjectiveOptions: TComboboxOption[] = [
  { label: "Calculate", value: "calculate" },
  { label: "Require Answer", value: "requireAnswer" },
  { label: "Jump to question", value: "jumpToQuestion" },
];

export const getConditionOperatorOptions = (
  condition: TSingleCondition,
  localSurvey: TSurvey
): TComboboxOption[] => {
  if (condition.leftOperand.type === "variable") {
    const variables = localSurvey.variables || [];
    const variableType =
      variables.find((variable) => variable.id === condition.leftOperand.value)?.type || "text";
    return ruleEngine.variable[variableType].options;
  } else if (condition.leftOperand.type === "hiddenField") {
    return ruleEngine.hiddenField.options;
  } else if (condition.leftOperand.type === "question") {
    const questions = localSurvey.questions || [];
    const question =
      questions.find((question) => question.id === condition.leftOperand.value) || questions[0];
    if (question.type === "openText") {
      const inputType = question.inputType === "number" ? "number" : "text";
      return ruleEngine.question.openText[inputType].options;
    }
    return ruleEngine.question[question.type].options;
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

  let questions = localSurvey.questions || [];
  let variables = localSurvey.variables || [];
  let hiddenFields = localSurvey.hiddenFields?.fieldIds || [];

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
      const allowedQuestions = questions.filter((question) => {
        const allowedQuestionTypes = [
          TSurveyQuestionTypeEnum.OpenText,
          TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          TSurveyQuestionTypeEnum.Rating,
          TSurveyQuestionTypeEnum.NPS,
        ];

        if (selectedQuestion.inputType !== "number") {
          allowedQuestionTypes.push(TSurveyQuestionTypeEnum.Date);
        }

        if (["equals", "doesNotEqual"].includes(condition.operator)) {
          allowedQuestionTypes.push(TSurveyQuestionTypeEnum.MultipleChoiceMulti);
        }

        return allowedQuestionTypes.includes(question.type);
      });

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
          label: choice.imageUrl.split("/").pop() || `Image ${idx + 1}`,
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
    const allowedQuestions = questions.filter((question) =>
      [
        TSurveyQuestionTypeEnum.OpenText,
        TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        TSurveyQuestionTypeEnum.MultipleChoiceMulti,
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
  action: TAction,
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
          ? getLocalizedValue(ending.headline, "default")
          : ending.label || "Redirect Thank you card",
      value: ending.id,
    };
  });

  return [...questionOptions, ...endingCardOptions];
};

export const getActionVariableOptions = (localSurvey: TSurvey): TComboboxOption[] => {
  const variables = localSurvey.variables || [];

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

export const getActionOpeartorOptions = (variableType?: TSurveyVariable["type"]): TComboboxOption[] => {
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

export const getActionValueOptions = (
  variableId: string,
  localSurvey: TSurvey,
  currQuestionIdx: number
): TComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds || [];
  let variables = localSurvey.variables || [];
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
    const allowedQuestions = questions.filter(
      (question, idx) =>
        idx !== currQuestionIdx &&
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
    const allowedQuestions = questions.filter(
      (question, idx) =>
        idx !== currQuestionIdx &&
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

export const findQuestionUsedInLogic = (survey: TSurvey, questionId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionsGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand, questionId)) ||
        isUsedInLeftOperand(condition.leftOperand, questionId)
      );
    }
  };

  const isUsedInLeftOperand = (leftOperand: TLeftOperand, id: string): boolean => {
    return leftOperand.type === "question" && leftOperand.value === id;
  };

  const isUsedInRightOperand = (rightOperand: TRightOperand, id: string): boolean => {
    return rightOperand.type === "question" && rightOperand.value === id;
  };

  const isUsedInAction = (action: TAction): boolean => {
    return (
      (action.objective === "jumpToQuestion" && action.target === questionId) ||
      (action.objective === "requireAnswer" && action.target === questionId)
    );
  };

  const isUsedInLogicRule = (logicRule: TSurveyAdvancedLogic): boolean => {
    return isUsedInCondition(logicRule.conditions) || logicRule.actions.some(isUsedInAction);
  };

  return survey.questions
    .filter((question) => question.id !== questionId)
    .findIndex((question) => question.logic && question.logic.some(isUsedInLogicRule));
};

export const findOptionUsedInLogic = (survey: TSurvey, questionId: string, optionId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionsGroup(condition)) {
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

  const isUsedInLogicRule = (logicRule: TSurveyAdvancedLogic): boolean => {
    return isUsedInCondition(logicRule.conditions);
  };

  return survey.questions.findIndex((question) => question.logic && question.logic.some(isUsedInLogicRule));
};

export const findVariableUsedInLogic = (survey: TSurvey, variableId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionsGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand)) ||
        isUsedInLeftOperand(condition.leftOperand)
      );
    }
  };

  const isUsedInLeftOperand = (leftOperand: TLeftOperand): boolean => {
    return leftOperand.type === "variable" && leftOperand.value === variableId;
  };

  const isUsedInRightOperand = (rightOperand: TRightOperand): boolean => {
    return rightOperand.type === "variable" && rightOperand.value === variableId;
  };

  const isUsedInAction = (action: TAction): boolean => {
    return action.objective === "calculate" && action.variableId === variableId;
  };

  const isUsedInLogicRule = (logicRule: TSurveyAdvancedLogic): boolean => {
    return isUsedInCondition(logicRule.conditions) || logicRule.actions.some(isUsedInAction);
  };

  return survey.questions.findIndex((question) => question.logic && question.logic.some(isUsedInLogicRule));
};

export const findHiddenFieldUsedInLogic = (survey: TSurvey, hiddenFieldId: string): number => {
  const isUsedInCondition = (condition: TSingleCondition | TConditionGroup): boolean => {
    if (isConditionsGroup(condition)) {
      // It's a TConditionGroup
      return condition.conditions.some(isUsedInCondition);
    } else {
      // It's a TSingleCondition
      return (
        (condition.rightOperand && isUsedInRightOperand(condition.rightOperand)) ||
        isUsedInLeftOperand(condition.leftOperand)
      );
    }
  };

  const isUsedInLeftOperand = (leftOperand: TLeftOperand): boolean => {
    return leftOperand.type === "hiddenField" && leftOperand.value === hiddenFieldId;
  };

  const isUsedInRightOperand = (rightOperand: TRightOperand): boolean => {
    return rightOperand.type === "hiddenField" && rightOperand.value === hiddenFieldId;
  };

  const isUsedInLogicRule = (logicRule: TSurveyAdvancedLogic): boolean => {
    return isUsedInCondition(logicRule.conditions);
  };

  return survey.questions.findIndex((question) => question.logic && question.logic.some(isUsedInLogicRule));
};
