import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { createI18nString } from "@formbricks/lib/i18n/utils";
import {
  TI18nString,
  TSurvey,
  TSurveyLanguage,
  TSurveyMultipleChoiceQuestion,
} from "@formbricks/types/surveys";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";

import { isLabelValidForAllLanguages } from "../lib/validation";

interface ChoiceProps {
  choice: {
    id: string;
    label: Record<string, string>;
  };
  choiceIdx: number;
  questionIdx: number;
  updateChoice: (choiceIdx: number, updatedAttributes: { label: TI18nString }) => void;
  deleteChoice: (choiceIdx: number) => void;
  addChoice: (choiceIdx: number) => void;
  setisInvalidValue: (value: string | null) => void;
  isInvalid: boolean;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  surveyLanguages: TSurveyLanguage[];
  findDuplicateLabel: () => string | null;
  question: TSurveyMultipleChoiceQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyMultipleChoiceQuestion>) => void;
  surveyLanguageCodes: string[];
}

export const SelectQuestionChoice = ({
  addChoice,
  choice,
  choiceIdx,
  deleteChoice,
  isInvalid,
  localSurvey,
  questionIdx,
  selectedLanguageCode,
  setSelectedLanguageCode,
  setisInvalidValue,
  surveyLanguages,
  updateChoice,
  findDuplicateLabel,
  question,
  surveyLanguageCodes,
  updateQuestion,
}: ChoiceProps) => {
  const isDragDisabled = choice.id === "other";
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: choice.id,
    disabled: isDragDisabled,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div className="flex w-full items-center gap-2" ref={setNodeRef} style={style}>
      {/* drag handle */}
      <div
        className={cn("flex items-center", choice.id === "other" && "invisible")}
        {...listeners}
        {...attributes}>
        <GripVerticalIcon className="mt-3 h-4 w-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full space-x-2">
        <QuestionFormInput
          key={choice.id}
          id={`choice-${choiceIdx}`}
          placeholder={choice.id === "other" ? "Other" : `Option ${choiceIdx + 1}`}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          value={choice.label}
          onBlur={() => {
            const duplicateLabel = findDuplicateLabel();
            if (duplicateLabel) {
              toast.error("Duplicate choices");
              setisInvalidValue(duplicateLabel);
            } else {
              setisInvalidValue(null);
            }
          }}
          updateChoice={updateChoice}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={
            isInvalid && !isLabelValidForAllLanguages(question.choices[choiceIdx].label, surveyLanguages)
          }
          className={`${choice.id === "other" ? "border border-dashed" : ""} mt-0`}
        />
        {choice.id === "other" && (
          <QuestionFormInput
            id="otherOptionPlaceholder"
            localSurvey={localSurvey}
            placeholder={"Please specify"}
            questionIdx={questionIdx}
            value={
              question.otherOptionPlaceholder
                ? question.otherOptionPlaceholder
                : createI18nString("Please specify", surveyLanguageCodes)
            }
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={
              isInvalid && !isLabelValidForAllLanguages(question.choices[choiceIdx].label, surveyLanguages)
            }
            className="border border-dashed"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {question.choices && question.choices.length > 2 && (
          <TrashIcon
            className="h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
            onClick={() => deleteChoice(choiceIdx)}
          />
        )}
        <div className="h-4 w-4">
          {choice.id !== "other" && (
            <PlusIcon
              className="h-full w-full cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => addChoice(choiceIdx)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
