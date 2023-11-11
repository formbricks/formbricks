import { TSurvey, TSurveyPictureSelectionQuestion } from "@formbricks/types/surveys";
import FileInput from "@formbricks/ui/FileInput";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import LocalizedInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/LocalizedInput";
import QuestionFormInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import { cn } from "@formbricks/lib/cn";
import { Button } from "@formbricks/ui/Button";
import { createId } from "@paralleldrive/cuid2";
import { useState } from "react";

interface PictureSelectionFormProps {
  localSurvey: TSurvey;
  question: TSurveyPictureSelectionQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
}

export default function PictureSelectionForm({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  selectedLanguage,
  setSelectedLanguage,
  languages,
}: PictureSelectionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const environmentId = localSurvey.environmentId;

  return (
    <form>
      <QuestionFormInput
        environmentId={environmentId}
        isInValid={isInValid}
        question={question}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        languages={languages}
      />
      <div className="mt-3">
        {showSubheader && (
          <>
            <Label htmlFor="subheader">Description</Label>
            <div className="mt-2 inline-flex w-full items-center">
              <LocalizedInput
                id="subheader"
                name="subheader"
                languages={languages}
                value={question.subheader}
                isInValid={isInValid}
                onChange={(e) => {
                  let translatedSubheader = {
                    ...question.subheader,
                    [selectedLanguage]: e.target.value,
                  };
                  updateQuestion(questionIdx, { subheader: translatedSubheader });
                }}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
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
      <div className="mt-2">
        <Label htmlFor="Images">
          Images{" "}
          <span
            className={cn("text-slate-400", {
              "text-red-600": isInValid && question.choices?.length < 2,
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
