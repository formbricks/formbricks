import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { TSurvey, TSurveyDateQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import QuestionFormInput from "@formbricks/ui/QuestionFormInput";
import { OptionsSwitcher } from "@formbricks/ui/QuestionTypeSelector";

interface IDateQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyDateQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
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
  isInvalid,
  localSurvey,
}: IDateQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);

  return (
    <form>
      <QuestionFormInput
        environmentId={localSurvey.environmentId}
        isInvalid={isInvalid}
        questionId={question.id}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        type="headline"
      />
      <div>
        {showSubheader && (
          <>
            <div className="flex w-full items-center">
              <QuestionFormInput
                localSurvey={localSurvey}
                environmentId={localSurvey.environmentId}
                isInvalid={isInvalid}
                questionId={question.id}
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
          <Button
            size="sm"
            className="mt-3"
            variant="minimal"
            type="button"
            onClick={() => setShowSubheader(true)}>
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
