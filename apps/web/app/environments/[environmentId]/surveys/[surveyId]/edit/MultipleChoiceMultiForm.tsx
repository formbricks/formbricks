import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import type { MultipleChoiceMultiQuestion } from "@formbricks/types/questions";
import { createId } from "@paralleldrive/cuid2";
import { TrashIcon } from "@heroicons/react/24/solid";

interface OpenQuestionFormProps {
  question: MultipleChoiceMultiQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
}

export default function MultipleChoiceMultiForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
}: OpenQuestionFormProps) {
  const updateChoice = (choiceIdx: number, updatedAttributes: any) => {
    const newChoices = !question.choices
      ? []
      : question.choices.map((choice, idx) => {
          if (idx === choiceIdx) {
            return { ...choice, ...updatedAttributes };
          }
          return choice;
        });
    updateQuestion(questionIdx, { choices: newChoices });
  };

  const addChoice = () => {
    const newChoices = !question.choices ? [] : question.choices;
    newChoices.push({ id: createId(), label: "" });
    updateQuestion(questionIdx, { choices: newChoices });
  };

  const deleteChoice = (choiceIdx: number) => {
    const newChoices = !question.choices ? [] : question.choices.filter((_, idx) => idx !== choiceIdx);
    updateQuestion(questionIdx, { choices: newChoices });
  };

  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="headline">Question</Label>
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
        <Label htmlFor="subheader">Description</Label>
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
        <Label htmlFor="choices">Options</Label>
        <div className="mt-2 space-y-2" id="choices">
          {question.choices &&
            question.choices.map((choice, choiceIdx) => (
              <div key={choiceIdx} className="inline-flex w-full items-center">
                <Input
                  id={choice.id}
                  name={choice.id}
                  value={choice.label}
                  placeholder={`Option ${choiceIdx + 1}`}
                  onChange={(e) => updateChoice(choiceIdx, { label: e.target.value })}
                />
                {question.choices && question.choices.length > 2 && (
                  <TrashIcon
                    className="ml-2 h-4 w-4 text-slate-400"
                    onClick={() => deleteChoice(choiceIdx)}
                  />
                )}
              </div>
            ))}
          <Button variant="secondary" type="button" onClick={() => addChoice()}>
            Add Option
          </Button>
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
