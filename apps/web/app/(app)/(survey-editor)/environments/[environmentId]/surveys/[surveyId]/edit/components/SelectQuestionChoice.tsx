import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { createI18nString } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TI18nString,
  TSurvey,
  TSurveyLanguage,
  TSurveyMultipleChoiceQuestion,
} from "@formbricks/types/surveys/types";
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
  isInvalid: boolean;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  surveyLanguages: TSurveyLanguage[];
  question: TSurveyMultipleChoiceQuestion;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyMultipleChoiceQuestion>) => void;
  surveyLanguageCodes: string[];
  attributeClasses: TAttributeClass[];
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
  surveyLanguages,
  updateChoice,
  question,
  surveyLanguageCodes,
  updateQuestion,
  attributeClasses,
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
    <div className="flex w-full gap-2" ref={setNodeRef} style={style}>
      {/* drag handle */}
      <div className={cn("mt-6", choice.id === "other" && "invisible")} {...listeners} {...attributes}>
        <GripVerticalIcon className="h-4 w-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full space-x-2">
        <QuestionFormInput
          key={choice.id}
          id={`choice-${choiceIdx}`}
          placeholder={choice.id === "other" ? "Other" : `Option ${choiceIdx + 1}`}
          label={""}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          value={choice.label}
          updateChoice={updateChoice}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={
            isInvalid && !isLabelValidForAllLanguages(question.choices[choiceIdx].label, surveyLanguages)
          }
          className={`${choice.id === "other" ? "border border-dashed" : ""} mt-0`}
          attributeClasses={attributeClasses}
        />
        {choice.id === "other" && (
          <QuestionFormInput
            id="otherOptionPlaceholder"
            localSurvey={localSurvey}
            placeholder={"Please specify"}
            label={""}
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
            attributeClasses={attributeClasses}
          />
        )}
      </div>
      <div className="mt-6 flex gap-2">
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
