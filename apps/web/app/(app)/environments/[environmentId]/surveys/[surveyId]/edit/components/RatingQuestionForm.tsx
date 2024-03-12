import { HashIcon, PlusIcon, SmileIcon, StarIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { TSurvey, TSurveyRatingQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import QuestionFormInput from "@formbricks/ui/QuestionFormInput";

import Dropdown from "./RatingTypeDropdown";

interface RatingQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyRatingQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
}

export default function RatingQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInvalid,
  localSurvey,
}: RatingQuestionFormProps) {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const environmentId = localSurvey.environmentId;

  return (
    <form>
      <QuestionFormInput
        localSurvey={localSurvey}
        environmentId={environmentId}
        isInvalid={isInvalid}
        questionId={question.id}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        type="headline"
      />

      <div>
        {showSubheader && (
          <>
            <div className="flex w-full items-center">
              <QuestionFormInput
                localSurvey={localSurvey}
                environmentId={environmentId}
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
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => setShowSubheader(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <Label htmlFor="subheader">Scale</Label>
          <div className="mt-2">
            <Dropdown
              options={[
                { label: "Number", value: "number", icon: HashIcon },
                { label: "Star", value: "star", icon: StarIcon },
                { label: "Smiley", value: "smiley", icon: SmileIcon },
              ]}
              defaultValue={question.scale || "number"}
              onSelect={(option) => updateQuestion(questionIdx, { scale: option.value })}
            />
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor="subheader">Range</Label>
          <div className="mt-2">
            <Dropdown
              options={[
                { label: "5 points (recommended)", value: 5 },
                { label: "3 points", value: 3 },
                { label: "4 points", value: 4 },
                { label: "7 points", value: 7 },
                { label: "10 points", value: 10 },
              ]}
              /* disabled={survey.status !== "draft"} */
              defaultValue={question.range || 5}
              onSelect={(option) => updateQuestion(questionIdx, { range: option.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <Label htmlFor="lowerLabel">Lower label</Label>
          <div className="mt-2">
            <Input
              id="lowerLabel"
              name="lowerLabel"
              placeholder="Not good"
              value={question.lowerLabel}
              onChange={(e) => updateQuestion(questionIdx, { lowerLabel: e.target.value })}
            />
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor="upperLabel">Upper label</Label>
          <div className="mt-2">
            <Input
              id="upperLabel"
              name="upperLabel"
              placeholder="Very satisfied"
              value={question.upperLabel}
              onChange={(e) => updateQuestion(questionIdx, { upperLabel: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        {!question.required && (
          <div className="flex-1">
            <Label htmlFor="buttonLabel">Dismiss Button Label</Label>
            <div className="mt-2">
              <Input
                id="dismissButtonLabel"
                name="dismissButtonLabel"
                value={question.buttonLabel}
                placeholder={lastQuestion ? "Finish" : "Next"}
                onChange={(e) => updateQuestion(questionIdx, { buttonLabel: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
