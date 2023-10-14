"use client";

import { md } from "@formbricks/lib/markdownIt";
import { TSurveyWelcomeQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Editor } from "@formbricks/ui/Editor";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { useState } from "react";
import { usePathname } from "next/navigation";
import FileInput from "@formbricks/ui/FileInput";

// import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";

interface WelcomeQuestionFormProps {
  localSurvey: TSurveyWithAnalytics;
  question: TSurveyWelcomeQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

export default function WelcomeQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInValid,
}: WelcomeQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);
  const path = usePathname();
  const environmentId = path?.split("/environments/")[1]?.split("/")[0];

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
      <div className="mt-3 flex w-full items-center justify-center">
        <FileInput
          question={question}
          questionIdx={questionIdx}
          updateQuestion={updateQuestion}
          allowedFileExtensions={["png", "jpeg", "jpg"]}
          environmentId={environmentId}
        />
      </div>
      <div className="mt-3 flex justify-between gap-8">
        <div className="flex w-full space-x-2">
          <div className="w-full">
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
        </div>
      </div>
      <div className="mt-3 flex items-center">
        <div className="mr-2">
          <Switch
            id="timeToFinish"
            name="timeToFinish"
            checked={question.timeToFinish}
            onCheckedChange={() => updateQuestion(questionIdx, { timeToFinish: !question.timeToFinish })}
          />
        </div>
        <div className="flex-column ">
          <Label htmlFor="timeToFinish" className="">
            Time to Finish
          </Label>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Display an estimate of completion time for survey
          </div>
        </div>
      </div>
    </form>
  );
}
