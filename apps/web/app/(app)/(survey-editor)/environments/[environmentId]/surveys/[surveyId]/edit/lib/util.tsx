import {
  ArrowUpFromLineIcon,
  CalendarDaysIcon,
  CheckIcon,
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
  TActionCalculateVariableType,
  TActionNumberVariableCalculateOperator,
  TActionTextVariableCalculateOperator,
} from "@formbricks/types/surveys/logic";
import { TSurveyQuestions } from "@formbricks/types/surveys/types";
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

export const getTargetOptions = (questions: TSurveyQuestions, currQuestionIdx: number): ComboboxOption[] => {
  return questions
    .filter((_, idx) => idx !== currQuestionIdx)
    .map((question) => {
      return {
        icon: questionIconMapping[question.type],
        label: getLocalizedValue(question.headline, "default"),
        value: question.id,
      };
    });
};

export const getOpeartorOptions = (variableType: TActionCalculateVariableType): ComboboxOption[] => {
  if (variableType === TActionCalculateVariableType.Number) {
    return [
      {
        label: "Add +",
        value: TActionNumberVariableCalculateOperator.Add,
      },
      {
        label: "Subtract -",
        value: TActionNumberVariableCalculateOperator.Subtract,
      },
      {
        label: "Multiply *",
        value: TActionNumberVariableCalculateOperator.Multiply,
      },
      {
        label: "Divide /",
        value: TActionNumberVariableCalculateOperator.Divide,
      },
      {
        label: "Assign =",
        value: TActionNumberVariableCalculateOperator.Assign,
      },
    ];
  } else if (variableType === TActionCalculateVariableType.Text) {
    return [
      {
        label: "Assign =",
        value: TActionTextVariableCalculateOperator.Assign,
      },
      {
        label: "Concat +",
        value: TActionTextVariableCalculateOperator.Concat,
      },
    ];
  }
  return [];
};

export const getValueOptions = (
  questions: TSurveyQuestions,
  currQuestionIdx: number,
  hiddenFields: string[],
  userAttributes: string[]
): ComboboxGroupedOption[] => {
  const groupedOptions: ComboboxGroupedOption[] = [];

  const questionOptions = getTargetOptions(questions, currQuestionIdx);
  const hiddenFieldsOptions = hiddenFields.map((field) => {
    return {
      label: field,
      value: field,
    };
  });

  const userAttributesOptions = userAttributes.map((attribute) => {
    return {
      label: attribute,
      value: attribute,
    };
  });

  if (questionOptions.length > 0) {
    groupedOptions.push({
      label: "Questions",
      value: "questions",
      options: questionOptions,
    });
  }

  if (hiddenFieldsOptions.length > 0) {
    groupedOptions.push({
      label: "Hidden Fields",
      value: "hiddenFields",
      options: hiddenFieldsOptions,
    });
  }

  if (userAttributesOptions.length > 0) {
    groupedOptions.push({
      label: "User Attributes",
      value: "userAttributes",
      options: userAttributesOptions,
    });
  }

  return groupedOptions;
};
