"use client";

import { md } from "@formbricks/lib/markdownIt";
import type { ConsentQuestion } from "@formbricks/types/questions";
import { Survey } from "@formbricks/types/surveys";
import { Editor, Input, Label } from "@formbricks/ui";
import { useState } from "react";

interface ConsentQuestionFormProps {
  localSurvey: Survey;
  question: ConsentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
}

export default function ConsentQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
}: ConsentQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);
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
          <Editor
            getText={() =>
              md.render(
                question.html || "We would love to talk to you and learn more about how you use our product."
              )
            }
            setText={(value: string) => {
              updateQuestion(questionIdx, { html: value });
            }}
            excludedToolbarItems={["blockType"]}
            disableLists
            firstRender={firstRender}
            setFirstRender={setFirstRender}
          />
        </div>
      </div>

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <Label htmlFor="label">Checkbox Label</Label>
          <div className="mt-2">
            <Input
              id="label"
              name="label"
              value={question.label}
              placeholder={lastQuestion ? "Finish" : "Next"}
              onChange={(e) => updateQuestion(questionIdx, { label: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        {!question.required && (
          <div className="flex-1">
            <Label htmlFor="dismissButtonLabel">Skip Button Label</Label>
            <div className="mt-2">
              <Input
                id="dismissButtonLabel"
                name="dismissButtonLabel"
                value={question.dismissButtonLabel}
                placeholder="Skip"
                onChange={(e) => updateQuestion(questionIdx, { dismissButtonLabel: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
