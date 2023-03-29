import { Input } from "@formbricks/ui";
import { Label } from "@formbricks/ui";
import type { OpenTextQuestion } from "@formbricks/types/questions";

interface OpenQuestionFormProps {
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
}: OpenQuestionFormProps) {
  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="headline">Headline</Label>
        <div className="mt-2">
          <Input
            id="headline"
            name="headline"
            value={question.headline}
            onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="subheader">Subheader</Label>
        <div className="mt-2">
          <Input
            id="subheader"
            name="subheader"
            value={question.subheader}
            onChange={(e) => updateQuestion(questionIdx, { subheader: e.target.value })}
          />
        </div>
      </div>

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
    </form>
  );
}
