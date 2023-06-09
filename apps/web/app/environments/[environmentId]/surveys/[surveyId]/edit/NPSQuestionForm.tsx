import type { NPSQuestion } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { Input, Label } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/solid";

interface NPSQuestionFormProps {
  localSurvey: Survey;
  question: NPSQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
}

export default function NPSQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
}: NPSQuestionFormProps): JSX.Element {
  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="headline">Question</Label>
        <div className="mt-2">
          <Input
            autoFocus
            id="headline"
            name="headline"
            value={question.headline}
            onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
          />
        </div>
      </div>

      {question.subheader && (
        <div className="mt-3">
          <Label htmlFor="subheader">Description</Label>
          <div className="mt-2 inline-flex w-full items-center">
            <Input
              id="subheader"
              name="subheader"
              value={question.subheader}
              onChange={(e) => updateQuestion(questionIdx, { subheader: e.target.value })}
            />
            <TrashIcon
              className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => updateQuestion(questionIdx, { subheader: "" })}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-between">
        <div>
          <Label htmlFor="subheader">Lower label</Label>
          <div className="mt-2">
            <Input
              id="subheader"
              name="subheader"
              value={question.lowerLabel}
              onChange={(e) => updateQuestion(questionIdx, { lowerLabel: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="subheader">Upper label</Label>
          <div className="mt-2">
            <Input
              id="subheader"
              name="subheader"
              value={question.upperLabel}
              onChange={(e) => updateQuestion(questionIdx, { upperLabel: e.target.value })}
            />
          </div>
        </div>
      </div>

      {!question.required && (
        <div className="mt-3">
          <Label htmlFor="buttonLabel">Button Label</Label>
          <div className="mt-2">
            <Input
              id="buttonLabel"
              name="buttonLabel"
              value={question.buttonLabel}
              placeholder={lastQuestion ? "Finish" : "Next"}
              onChange={(e) => updateQuestion(questionIdx, { buttonLabel: e.target.value })}
            />
          </div>
        </div>
      )}
    </form>
  );
}
