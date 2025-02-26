import { getQuestionTypes } from "@/modules/survey/editor/lib/questions";
import { TriggerUpdate } from "@/modules/survey/editor/types/survey-trigger";
import { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";
import { ActionClass } from "@prisma/client";
import { TFnType } from "@tolgee/react";
import { EyeOffIcon, FileDigitIcon, FileType2Icon } from "lucide-react";
import { HTMLInputTypeAttribute } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { isConditionGroup } from "@formbricks/lib/surveyLogic/utils";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  TConditionGroup,
  TLeftOperand,
  TRightOperand,
  TSingleCondition,
  TSurvey,
  TSurveyLogic,
  TSurveyLogicAction,
  TSurveyLogicActions,
  TSurveyLogicConditionsOperator,
  TSurveyQuestion,
  TSurveyQuestionId,
  TSurveyQuestionTypeEnum,
  TSurveyVariable,
} from "@formbricks/types/surveys/types";
import { TLogicRuleOption, getLogicRules } from "./logic-rule-engine";

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

const getQuestionIconMapping = (t: TFnType) =>
  getQuestionTypes(t).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.icon,
    }),
    {}
  );

export const getConditionValueOptions = (
  localSurvey: TSurvey,
  currQuestionIdx: number,
  t: TFnType
): TComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds ?? [];
  const variables = localSurvey.variables ?? [];
  const questions = localSurvey.questions;

  const groupedOptions: TComboboxGroupedOption[] = [];
  const questionOptions = questions
    .filter((_, idx) => idx <= currQuestionIdx)
    .map((question) => {
      return {
        icon: getQuestionIconMapping(t)[question.type],
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
      label: t("common.questions"),
      value: "questions",
      options: questionOptions,
    });
  }

  if (variableOptions.length > 0) {
    groupedOptions.push({
      label: t("common.variables"),
      value: "variables",
      options: variableOptions,
    });
  }

  if (hiddenFieldsOptions.length > 0) {
    groupedOptions.push({
      label: t("common.hidden_fields"),
      value: "hiddenFields",
      options: hiddenFieldsOptions,
    });
  }

  return groupedOptions;
};

export const replaceEndingCardHeadlineRecall = (survey: TSurvey, language: string) => {
  const modifiedSurvey = structuredClone(survey);
  modifiedSurvey.endings.forEach((ending) => {
    if (ending.type === "endScreen") {
      ending.headline = recallToHeadline(ending.headline || {}, modifiedSurvey, false, language);
    }
  });
  return modifiedSurvey;
};

export const getActionObjectiveOptions = (t: TFnType): TComboboxOption[] => [
  { label: t("environments.surveys.edit.calculate"), value: "calculate" },
  { label: t("environments.surveys.edit.require_answer"), value: "requireAnswer" },
  { label: t("environments.surveys.edit.jump_to_question"), value: "jumpToQuestion" },
];

export const hasJumpToQuestionAction = (actions: TSurveyLogicActions): boolean => {
  return actions.some((action) => action.objective === "jumpToQuestion");
};

const getQuestionOperatorOptions = (question: TSurveyQuestion, t: TFnType): TComboboxOption[] => {
  let options: TLogicRuleOption;

  if (question.type === "openText") {
    const inputType = question.inputType === "number" ? "number" : "text";
    options = getLogicRules(t).question[`openText.${inputType}`].options;
  } else {
    options = getLogicRules(t).question[question.type].options;
  }

  if (question.required) {
    options = options.filter((option) => option.value !== "isSkipped") as TLogicRuleOption;
  }

  return options;
};

export const getDefaultOperatorForQuestion = (
  question: TSurveyQuestion,
  t: TFnType
): TSurveyLogicConditionsOperator => {
  const options = getQuestionOperatorOptions(question, t);

  return options[0].value.toString() as TSurveyLogicConditionsOperator;
};

export const getConditionOperatorOptions = (
  condition: TSingleCondition,
  localSurvey: TSurvey,
  t: TFnType
): TComboboxOption[] => {
  if (condition.leftOperand.type === "variable") {
    const variables = localSurvey.variables ?? [];
    const variableType =
      variables.find((variable) => variable.id === condition.leftOperand.value)?.type || "text";
    return getLogicRules(t)[`variable.${variableType}`].options;
  } else if (condition.leftOperand.type === "hiddenField") {
    return getLogicRules(t).hiddenField.options;
  } else if (condition.leftOperand.type === "question") {
    const questions = localSurvey.questions ?? [];
    const question = questions.find((question) => question.id === condition.leftOperand.value);

    if (!question) return [];

    return getQuestionOperatorOptions(question, t);
  }
  return [];
};

export const getMatchValueProps = (
  condition: TSingleCondition,
  localSurvey: TSurvey,
  questionIdx: number,
  t: TFnType
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
      "isSet",
      "isNotSet",
    ].includes(condition.operator)
  ) {
    return { show: false, options: [] };
  }

  let questions = localSurvey.questions.filter((_, idx) => idx <= questionIdx);
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
          icon: getQuestionIconMapping(t)[question.type],
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
          label: t("common.questions"),
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
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
        options: [{ label: t("common.choices"), value: "choices", options: choices }],
      };
    } else if (selectedQuestion?.type === TSurveyQuestionTypeEnum.PictureSelection) {
      const choices = selectedQuestion.choices.map((choice, idx) => {
        return {
          imgSrc: choice.imageUrl,
          label: `${t("environments.surveys.edit.picture_idx")} ${idx + 1}`,
          value: choice.id,
          meta: {
            type: "static",
          },
        };
      });

      return {
        show: true,
        showInput: false,
        options: [{ label: t("common.choices"), value: "choices", options: choices }],
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
          label: t("common.choices"),
          value: "choices",
          options: choices,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
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
          label: t("common.choices"),
          value: "choices",
          options: choices,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
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
          icon: getQuestionIconMapping(t)[question.type],
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
          label: t("common.questions"),
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
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
          icon: getQuestionIconMapping(t)[question.type],
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
          label: t("common.questions"),
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
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
      const allowedQuestions = questions.filter(
        (question) =>
          [TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS].includes(question.type) ||
          (question.type === TSurveyQuestionTypeEnum.OpenText && question.inputType === "number")
      );

      const questionOptions = allowedQuestions.map((question) => {
        return {
          icon: getQuestionIconMapping(t)[question.type],
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
          label: t("common.questions"),
          value: "questions",
          options: questionOptions,
        });
      }

      if (variableOptions.length > 0) {
        groupedOptions.push({
          label: t("common.variables"),
          value: "variables",
          options: variableOptions,
        });
      }

      if (hiddenFieldsOptions.length > 0) {
        groupedOptions.push({
          label: t("common.hidden_fields"),
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
        icon: getQuestionIconMapping(t)[question.type],
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
        label: t("common.questions"),
        value: "questions",
        options: questionOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: t("common.variables"),
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: t("common.hidden_fields"),
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
  currQuestionIdx: number,
  t: TFnType
): TComboboxOption[] => {
  let questions = localSurvey.questions.filter((_, idx) => idx > currQuestionIdx);

  if (action.objective === "requireAnswer") {
    questions = questions.filter((question) => !question.required);
  }

  const questionOptions = questions.map((question) => {
    return {
      icon: getQuestionIconMapping(t)[question.type],
      label: getLocalizedValue(question.headline, "default"),
      value: question.id,
    };
  });

  if (action.objective === "requireAnswer") return questionOptions;

  const endingCardOptions = localSurvey.endings.map((ending) => {
    return {
      label:
        ending.type === "endScreen"
          ? getLocalizedValue(ending.headline, "default") || t("environments.surveys.edit.end_screen_card")
          : ending.label || t("environments.surveys.edit.redirect_thank_you_card"),
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

export const getActionOperatorOptions = (
  t: TFnType,
  variableType?: TSurveyVariable["type"]
): TComboboxOption[] => {
  if (variableType === "number") {
    return [
      {
        label: t("environments.surveys.edit.add"),
        value: "add",
      },
      {
        label: t("environments.surveys.edit.subtract"),
        value: "subtract",
      },
      {
        label: t("environments.surveys.edit.multiply"),
        value: "multiply",
      },
      {
        label: t("environments.surveys.edit.divide"),
        value: "divide",
      },
      {
        label: t("environments.surveys.edit.assign"),
        value: "assign",
      },
    ];
  } else if (variableType === "text") {
    return [
      {
        label: t("environments.surveys.edit.assign"),
        value: "assign",
      },
      {
        label: t("environments.surveys.edit.concat"),
        value: "concat",
      },
    ];
  }
  return [];
};

export const getActionValueOptions = (
  variableId: string,
  localSurvey: TSurvey,
  questionIdx: number,
  t: TFnType
): TComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds ?? [];
  let variables = localSurvey.variables ?? [];
  const questions = localSurvey.questions.filter((_, idx) => idx <= questionIdx);

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
        icon: getQuestionIconMapping(t)[question.type],
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
        label: t("common.questions"),
        value: "questions",
        options: questionOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: t("common.variables"),
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: t("common.hidden_fields"),
        value: "hiddenFields",
        options: hiddenFieldsOptions,
      });
    }

    return groupedOptions;
  } else if (selectedVariable.type === "number") {
    const allowedQuestions = questions.filter(
      (question) =>
        [TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS].includes(question.type) ||
        (question.type === TSurveyQuestionTypeEnum.OpenText && question.inputType === "number")
    );

    const questionOptions = allowedQuestions.map((question) => {
      return {
        icon: getQuestionIconMapping(t)[question.type],
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
        label: t("common.questions"),
        value: "questions",
        options: questionOptions,
      });
    }

    if (variableOptions.length > 0) {
      groupedOptions.push({
        label: t("common.variables"),
        value: "variables",
        options: variableOptions,
      });
    }

    if (hiddenFieldsOptions.length > 0) {
      groupedOptions.push({
        label: t("common.hidden_fields"),
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
    (question) =>
      question.logicFallback === questionId ||
      (question.id !== questionId && question.logic?.some(isUsedInLogicRule))
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

export const getSurveyFollowUpActionDefaultBody = (t: TFnType) => {
  return t("templates.follow_ups_modal_action_body") as string;
};

export const findEndingCardUsedInLogic = (survey: TSurvey, endingCardId: string): number => {
  const isUsedInAction = (action: TSurveyLogicAction): boolean => {
    return action.objective === "jumpToQuestion" && action.target === endingCardId;
  };

  const isUsedInLogicRule = (logicRule: TSurveyLogic): boolean => {
    return logicRule.actions.some(isUsedInAction);
  };

  return survey.questions.findIndex(
    (question) => question.logicFallback === endingCardId || question.logic?.some(isUsedInLogicRule)
  );
};

const checkTriggersValidity = (triggers: TSurvey["triggers"], actionClasses: ActionClass[]) => {
  if (!triggers) return;

  // check if all the triggers are valid
  triggers.forEach((trigger) => {
    if (!actionClasses.find((actionClass) => actionClass.id === trigger.actionClass.id)) {
      throw new InvalidInputError("Invalid trigger id");
    }
  });

  // check if all the triggers are unique
  const triggerIds = triggers.map((trigger) => trigger.actionClass.id);

  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new InvalidInputError("Duplicate trigger id");
  }
};

export const handleTriggerUpdates = (
  updatedTriggers: TSurvey["triggers"],
  currentTriggers: TSurvey["triggers"],
  actionClasses: ActionClass[]
) => {
  if (!updatedTriggers) return {};
  checkTriggersValidity(updatedTriggers, actionClasses);

  const currentTriggerIds = currentTriggers.map((trigger) => trigger.actionClass.id);
  const updatedTriggerIds = updatedTriggers.map((trigger) => trigger.actionClass.id);

  // added triggers are triggers that are not in the current triggers and are there in the new triggers
  const addedTriggers = updatedTriggers.filter(
    (trigger) => !currentTriggerIds.includes(trigger.actionClass.id)
  );

  // deleted triggers are triggers that are not in the new triggers and are there in the current triggers
  const deletedTriggers = currentTriggers.filter(
    (trigger) => !updatedTriggerIds.includes(trigger.actionClass.id)
  );

  // Construct the triggers update object
  const triggersUpdate: TriggerUpdate = {};

  if (addedTriggers.length > 0) {
    triggersUpdate.create = addedTriggers.map((trigger) => ({
      actionClassId: trigger.actionClass.id,
    }));
  }

  if (deletedTriggers.length > 0) {
    // disconnect the public triggers from the survey
    triggersUpdate.deleteMany = {
      actionClassId: {
        in: deletedTriggers.map((trigger) => trigger.actionClass.id),
      },
    };
  }

  [...addedTriggers, ...deletedTriggers].forEach((trigger) => {
    surveyCache.revalidate({
      actionClassId: trigger.actionClass.id,
    });
  });

  return triggersUpdate;
};
