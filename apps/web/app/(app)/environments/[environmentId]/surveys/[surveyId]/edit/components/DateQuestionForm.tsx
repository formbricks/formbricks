import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

import { TSurvey, TSurveyDateQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { OptionsSwitcher } from "@formbricks/ui/QuestionTypeSelector";

import QuestionFormInput from "./QuestionFormInput";

interface IDateQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyDateQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

const dateOptions = [
  {
    value: "M-d-y",
    label: "MM-DD-YYYY",
  },
  {
    value: "d-M-y",
    label: "DD-MM-YYYY",
  },
  {
    value: "y-M-d",
    label: "YYYY-MM-DD",
  },
];

export default function DateQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  localSurvey,
}: IDateQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);

  return (
    <form>
      <QuestionFormInput
        environmentId={localSurvey.environmentId}
        isInValid={isInValid}
        question={question}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        type="headline"
      />
      <div className="mt-3">
        {showSubheader && (
          <>
            <div className="mt-2 flex w-full items-center">
              <QuestionFormInput
                localSurvey={localSurvey}
                environmentId={localSurvey.environmentId}
                isInValid={isInValid}
                question={question}
                questionIdx={questionIdx}
                updateQuestion={updateQuestion}
                type="subheader"
              />
              <TrashIcon
                className="ml-2 mt-10 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                onClick={() => {
                  setShowSubheader(false);
                  updateQuestion(questionIdx, { subheader: "" });
                }}
              />
            </div>
          </>
        )}

        {!showSubheader && (
          <Button size="sm" variant="minimal" type="button" onClick={() => setShowSubheader(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="questionType">Date Format</Label>
        <div className="mt-2 flex items-center">
          <OptionsSwitcher
            options={dateOptions}
            currentOption={question.format}
            handleTypeChange={(value) => updateQuestion(questionIdx, { format: value })}
          />
        </div>
      </div>
    </form>
  );
}
