import type { OpenTextQuestion } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { Input, Label } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/solid";

interface OpenQuestionFormProps {
  localSurvey: Survey;
  question: OpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
}

export default function OpenQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
}: OpenQuestionFormProps): JSX.Element {
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

      {/* <div className="mt-3">
        <Label htmlFor="subheader">Description</Label>
        <div className="mt-2">
          <Input
            id="subheader"
            name="subheader"
            value={question.subheader}
            onChange={(e) => updateQuestion(questionIdx, { subheader: e.target.value })}
          />
        </div>
      </div> */}

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

      <div className="mt-3">
        <Label htmlFor="placeholder">Placeholder</Label>
        <div className="mt-2">
          <Input
            id="placeholder"
            name="placeholder"
            value={question.placeholder}
            onChange={(e) => updateQuestion(questionIdx, { placeholder: e.target.value })}
          />
        </div>
      </div>
    </form>
  );
}
