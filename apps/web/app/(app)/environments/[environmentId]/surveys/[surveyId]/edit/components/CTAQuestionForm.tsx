"use client";

import { BackButtonInput } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionCard";
import { md } from "@formbricks/lib/markdownIt";
import { TSurvey, TSurveyCTAQuestion } from "@formbricks/types/v1/surveys";
import { Editor } from "@formbricks/ui/Editor";
import FileInput from "@formbricks/ui/FileInput";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";
import { ImagePlusIcon } from "lucide-react";
import { useState } from "react";

interface CTAQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCTAQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

export default function CTAQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInValid,
  localSurvey,
}: CTAQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(!!question.imageUrl);
  const environmentId = localSurvey.environmentId;

  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="headline">Question</Label>
        <div className="mt-2 flex flex-col gap-6">
          {showImageUploader && (
            <FileInput
              allowedFileExtensions={["png", "jpeg", "jpg"]}
              environmentId={environmentId}
              onFileUpload={(url: string) => {
                updateQuestion(questionIdx, { imageUrl: url });
              }}
              fileUrl={question.imageUrl || ""}
            />
          )}
          <div className="flex items-center space-x-2">
            <Input
              autoFocus
              id="headline"
              name="headline"
              value={question.headline}
              onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
              isInvalid={isInValid && question.headline.trim() === ""}
            />
            <ImagePlusIcon
              className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => setShowImageUploader((prev) => !prev)}
            />
          </div>
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

      <RadioGroup
        className="mt-3 flex"
        defaultValue="internal"
        value={question.buttonExternal ? "external" : "internal"}
        onValueChange={(e) => updateQuestion(questionIdx, { buttonExternal: e === "external" })}>
        <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3 dark:border-slate-500">
          <RadioGroupItem value="internal" id="internal" className="bg-slate-50" />
          <Label htmlFor="internal" className="cursor-pointer dark:text-slate-200">
            Button to continue in survey
          </Label>
        </div>
        <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3 dark:border-slate-500">
          <RadioGroupItem value="external" id="external" className="bg-slate-50" />
          <Label htmlFor="external" className="cursor-pointer dark:text-slate-200">
            Button to link to external URL
          </Label>
        </div>
      </RadioGroup>

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
          {questionIdx !== 0 && (
            <BackButtonInput
              value={question.backButtonLabel}
              onChange={(e) => updateQuestion(questionIdx, { backButtonLabel: e.target.value })}
            />
          )}
        </div>
      </div>

      {question.buttonExternal && (
        <div className="mt-3 flex-1">
          <Label htmlFor="buttonLabel">Button URL</Label>
          <div className="mt-2">
            <Input
              id="buttonUrl"
              name="buttonUrl"
              value={question.buttonUrl}
              placeholder="https://website.com"
              onChange={(e) => updateQuestion(questionIdx, { buttonUrl: e.target.value })}
            />
          </div>
        </div>
      )}

      {!question.required && (
        <div className="mt-3 flex-1">
          <Label htmlFor="buttonLabel">Skip Button Label</Label>
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
    </form>
  );
}
