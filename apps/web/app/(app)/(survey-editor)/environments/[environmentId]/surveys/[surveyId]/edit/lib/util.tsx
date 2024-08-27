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
  MessageSquareTextIcon,
  MousePointerClickIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  StarIcon,
} from "lucide-react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import {
  TActionObjective,
  TActionVariableCalculateOperator,
  TSingleCondition,
} from "@formbricks/types/surveys/logic";
import { TSurvey, TSurveyQuestionTypeEnum, TSurveyVariable } from "@formbricks/types/surveys/types";
import { ComboboxGroupedOption, ComboboxOption } from "@formbricks/ui/InputCombobox";

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
  address: HomeIcon,
};

export const getConditionValueOptions = (
  localSurvey: TSurvey,
  currQuestionIdx: number
): ComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds || [];
  const variables = localSurvey.variables || [];
  const questions = localSurvey.questions;

  const groupedOptions: ComboboxGroupedOption[] = [];
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

export const actionObjectiveOptions: ComboboxOption<TActionObjective>[] = [
  { label: "Calculate", value: "calculate" },
  { label: "Require Answer", value: "requireAnswer" },
  { label: "Jump to question", value: "jumpToQuestion" },
];

export const getConditionOperatorOptions = (
  condition: TSingleCondition,
  localSurvey: TSurvey
): ComboboxOption[] => {
  if (condition.leftOperand.type === "variable") {
    const variables = localSurvey.variables || [];
    const variableType =
      variables.find((variable) => variable.id === condition.leftOperand.id)?.type || "text";
    return ruleEngine.variable[variableType].options;
  } else if (condition.leftOperand.type === "hiddenField") {
    return ruleEngine.hiddenField.options;
  } else if (condition.leftOperand.type === "question") {
    const questions = localSurvey.questions || [];
    const question = questions.find((question) => question.id === condition.leftOperand.id) || questions[0];
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
): { show?: boolean; showInput?: boolean; options: ComboboxGroupedOption[] } => {
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

  if (condition.leftOperand.type === "question") {
    const selectedQuestion = questions.find((question) => question.id === condition.leftOperand.id);

    if (
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
    }

    if (selectedQuestion?.type === TSurveyQuestionTypeEnum.PictureSelection) {
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
    }
  }

  if (condition.leftOperand.type === "question") {
    questions = questions.filter((question) => question.id !== condition.leftOperand.id);
  } else if (condition.leftOperand.type === "variable") {
    variables = variables.filter((variable) => variable.id !== condition.leftOperand.id);
  } else if (condition.leftOperand.type === "hiddenField") {
    hiddenFields = hiddenFields.filter((field) => field !== condition.leftOperand.id);
  }

  let questionOptions = questions.map((question) => {
    return {
      icon: questionIconMapping[question.type],
      label: getLocalizedValue(question.headline, "default"),
      value: question.id,
      meta: {
        type: "question",
      },
    };
  });

  let variableOptions = variables.map((variable) => {
    return {
      icon: variable.type === "number" ? FileDigitIcon : FileType2Icon,
      label: variable.name,
      value: variable.id,
      meta: {
        type: "variable",
      },
    };
  });

  let hiddenFieldsOptions = hiddenFields.map((field) => {
    return {
      icon: EyeOffIcon,
      label: field,
      value: field,
      meta: {
        type: "hiddenField",
      },
    };
  });

  const groupedOptions: ComboboxGroupedOption[] = [];

  if (condition.leftOperand.type === "hiddenField") {
    hiddenFieldsOptions = hiddenFieldsOptions?.filter((field) => field.value !== condition.leftOperand.id);
  } else if (condition.leftOperand.type === "variable") {
    variableOptions = variableOptions?.filter((variable) => variable.value !== condition.leftOperand.id);
  } else if (condition.leftOperand.type === "question") {
    questionOptions = questionOptions?.filter((question) => question.value !== condition.leftOperand.id);

    const question = localSurvey.questions.find((question) => question.id === condition.leftOperand.id);

    let choices: ComboboxOption[] = [];
    if (
      question &&
      (question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti)
    ) {
      choices = question.choices.map((choice) => ({
        label: getLocalizedValue(choice.label, "default"),
        value: choice.id,
      }));
    }
    if (question && question.type === TSurveyQuestionTypeEnum.PictureSelection) {
      choices = question.choices.map((choice, idx) => ({
        label: choice.imageUrl.split("/").pop() || `Image ${idx + 1}`,
        value: choice.id,
      }));
    }

    if (choices.length > 0) {
      groupedOptions.push({
        label: "Choices",
        value: "choices",
        options: choices,
      });
    }
  }

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

  return { show: true, options: groupedOptions };

  // const question = localSurvey.questions[questionIdx];

  return { show: true, options: [] };
};

export const getActionTargetOptions = (localSurvey: TSurvey, currQuestionIdx: number): ComboboxOption[] => {
  const questionOptions = localSurvey.questions
    .filter((_, idx) => idx !== currQuestionIdx)
    .map((question) => {
      return {
        icon: questionIconMapping[question.type],
        label: getLocalizedValue(question.headline, "default"),
        value: question.id,
      };
    });

  const endingCardOptions = localSurvey.endings.map((ending) => {
    return {
      label:
        ending.type === "endScreen"
          ? `🙏${getLocalizedValue(ending.headline, "default")}`
          : `🙏 ${ending.label || "Redirect Thank you card"}`,
      value: ending.id,
    };
  });

  return [...questionOptions, ...endingCardOptions];
};

export const getActionVariableOptions = (localSurvey: TSurvey): ComboboxOption[] => {
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

export const getActionOpeartorOptions = (
  variableType?: TSurveyVariable["type"]
): ComboboxOption<TActionVariableCalculateOperator>[] => {
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
): ComboboxGroupedOption[] => {
  const hiddenFields = localSurvey.hiddenFields?.fieldIds || [];
  const variables = localSurvey.variables || [];
  const questions = localSurvey.questions;

  const groupedOptions: ComboboxGroupedOption[] = [];

  // const questionOptions = getActionTargetOptions(questions, currQuestionIdx);
  const questionOptions = questions
    .filter((_, idx) => idx !== currQuestionIdx)
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

  const selectedVariable = variables.find((variable) => variable.id === variableId);
  const variableOptions = variables
    .filter((variable) => variable.type === selectedVariable?.type && variable.id !== variableId)
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
