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
  isInValid: boolean;
}

export default function ConsentQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
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
            isInvalid={isInValid && question.headline.trim() === ""}
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

      <div className="mt-3">
        <Label htmlFor="label">Checkbox Label</Label>
        <Input
          id="label"
          name="label"
          className="mt-2"
          value={question.label}
          placeholder="I agree to the terms and conditions"
          onChange={(e) => updateQuestion(questionIdx, { label: e.target.value })}
          isInvalid={isInValid && question.label.trim() === ""}
        />
      </div>
      {/* <div className="mt-3">
        <Label htmlFor="buttonLabel">Button Label</Label>
        <Input
          id="buttonLabel"
          name="buttonLabel"
          className="mt-2"
          value={question.buttonLabel}
          placeholder={lastQuestion ? "Finish" : "Next"}
          onChange={(e) => updateQuestion(questionIdx, { buttonLabel: e.target.value })}
        />
      </div> */}
    </form>
  );
}
