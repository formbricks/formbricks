import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { createId } from "@paralleldrive/cuid2";
import { useState } from "react";

import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { createI18nString } from "@formbricks/ee/multiLanguage/utils/i18n";
import { cn } from "@formbricks/lib/cn";
import { TI18nString, TSurvey, TSurveyPictureSelectionQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import FileInput from "@formbricks/ui/FileInput";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";

interface PictureSelectionFormProps {
  localSurvey: TSurvey;
  question: TSurveyPictureSelectionQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
  isInvalid: boolean;
}

export default function PictureSelectionForm({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  selectedLanguage,
  setSelectedLanguage,
  languages,
  isInvalid,
}: PictureSelectionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const environmentId = localSurvey.environmentId;

  return (
    <form>
      <LocalizedInput
        id="headline"
        name="headline"
        value={question.headline as TI18nString}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        languages={languages}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />
      <div>
        {showSubheader && (
          <div className="mt-2 inline-flex w-full items-center">
            <div className="w-full">
              <LocalizedInput
                id="subheader"
                name="subheader"
                value={question.subheader as TI18nString}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                languages={languages}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
              />
            </div>

            <TrashIcon
              className="ml-2 mt-10 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => {
                setShowSubheader(false);
                updateQuestion(questionIdx, { subheader: undefined });
              }}
            />
          </div>
        )}
        {!showSubheader && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", extractLanguageSymbols(languages)),
              });
              setShowSubheader(true);
            }}>
            {" "}
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>
      <div className="mt-2">
        <Label htmlFor="Images">
          Images{" "}
          <span
            className={cn("text-slate-400", {
              "text-red-600": isInvalid && question.choices?.length < 2,
            })}>
            (Upload at least 2 images)
          </span>
        </Label>
        <div className="mt-3 flex w-full items-center justify-center">
          <FileInput
            id="choices-file-input"
            allowedFileExtensions={["png", "jpeg", "jpg"]}
            environmentId={environmentId}
            onFileUpload={(urls: string[]) => {
              updateQuestion(questionIdx, {
                choices: urls.map((url) => ({ imageUrl: url, id: createId() })),
              });
            }}
            fileUrl={question?.choices?.map((choice) => choice.imageUrl)}
            multiple={true}
          />
        </div>
      </div>

      <div className="my-4 flex items-center space-x-2">
        <Switch
          id="multi-select-toggle"
          checked={question.allowMulti}
          onClick={(e) => {
            e.stopPropagation();
            updateQuestion(questionIdx, { allowMulti: !question.allowMulti });
          }}
        />
        <Label htmlFor="multi-select-toggle" className="cursor-pointer">
          <div className="ml-2">
            <h3 className="text-sm font-semibold text-slate-700">Allow Multi Select</h3>
            <p className="text-xs font-normal text-slate-500">Allow users to select more than one image.</p>
          </div>
        </Label>
      </div>
    </form>
  );
}
