import type { RatingQuestion } from "@formbricks/types/questions";
import { Input, Label } from "@formbricks/ui";
import { HashtagIcon, StarIcon, FaceSmileIcon } from "@heroicons/react/24/outline";

import Dropdown from "./RatingTypeDropdown";

interface RatingQuestionFormProps {
  question: RatingQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
}

export default function RatingQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
}: RatingQuestionFormProps) {
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

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <Label htmlFor="subheader">Scale</Label>
          <div className="mt-2">
            <Dropdown
              options={[
                { label: "Number", value: "number", icon: HashtagIcon },
                { label: "Star", value: "star", icon: StarIcon, disabled: true },
                { label: "Smiley", value: "smiley", icon: FaceSmileIcon, disabled: true },
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
                { label: "5 points (recommended)", value: "5" },
                { label: "3 points", value: "3" },
                { label: "4 points", value: "4" },
                { label: "7 points", value: "7" },
                { label: "10 points", value: "10" },
              ]}
              defaultValue={question.range || "5"}
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
