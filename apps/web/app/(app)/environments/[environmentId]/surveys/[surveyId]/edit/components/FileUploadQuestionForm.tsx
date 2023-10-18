import { TSurveyFileUploadQuestion, TSurvey } from "@formbricks/types/v1/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { Input } from "@formbricks/ui/Input";
import { Switch } from "@formbricks/ui/Switch";

import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

interface FileUploadFormProps {
  localSurvey: TSurvey;
  question: TSurveyFileUploadQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

export default function FileUploadQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
}: FileUploadFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);

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
        {showSubheader && (
          <>
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
                onClick={() => {
                  setShowSubheader(false);
                  updateQuestion(questionIdx, { subheader: "" });
                }}
              />
            </div>
          </>
        )}
        {!showSubheader && (
          <Button size="sm" variant="minimal" type="button" onClick={() => setShowSubheader(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>
      {/* Add a dropdown to select the question type */}
      <div className="mt-8 flex items-center">
        <div className="mr-2">
          <Switch
            id="m"
            name="allowMultipleFile"
            checked={question.allowMultipleFile}
            onCheckedChange={() =>
              updateQuestion(questionIdx, { allowMultipleFile: !question.allowMultipleFile })
            }
          />
        </div>
        <div className="flex-column">
          <Label htmlFor="allowMultipleFile" className="">
            Allow Multiple Files
          </Label>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Let people upload up to 10 files at the same time.
          </div>
        </div>
      </div>
      <div className="mt-8 flex items-center">
        <div className="mr-2">
          <Switch
            id="m"
            name="limitSize"
            checked={question.limitSize}
            onCheckedChange={() => updateQuestion(questionIdx, { limitSize: !question.limitSize })}
          />
        </div>
        <div className="flex-column">
          <Label htmlFor="limitSize" className="">
            Max file size
          </Label>
          <div className="text-sm text-gray-500 dark:text-gray-400">Limit the maximum file size.</div>
        </div>
      </div>
      {question.limitSize && (
        <div className="mt-3">
          <div className="mt-2 flex w-full items-center justify-between rounded-md border bg-slate-50 p-5">
            <div className="rounded-md  bg-white p-2">
              <input
                className="rounded-md border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                id="maxSize"
                name="maxSize"
                type="number"
                value={question?.maxSize}
                onChange={(e) => updateQuestion(questionIdx, { maxSize: e.target.value })}
              />
              MB
            </div>
          </div>
        </div>
      )}
      <div className="mt-8 flex items-center">
        <div className="mr-2">
          <Switch
            id="m"
            name="limitFileType"
            checked={question.limitFileType}
            onCheckedChange={() => updateQuestion(questionIdx, { limitFileType: !question.limitFileType })}
          />
        </div>
        <div className="flex-column">
          <Label htmlFor="limitFileType" className="">
            Allowed file types
          </Label>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Control which file types can be uploaded.
          </div>
        </div>
      </div>
      {question.limitFileType && (
        <div className="mt-3">
          <div className="mt-2 flex w-full items-center justify-between rounded-md border bg-slate-50 p-5">
            <div className="flex items-center justify-center rounded-lg bg-slate-100 p-4">
              <input
                className="w-36 rounded-md border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder="Add pdf"
                type="text"
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
