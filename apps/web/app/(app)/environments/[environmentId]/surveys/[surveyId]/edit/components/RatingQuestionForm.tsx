import { FaceSmileIcon, HashtagIcon, StarIcon } from "@heroicons/react/24/outline";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { createI18nString } from "@formbricks/ee/multiLanguage/utils/i18n";
import { TSurvey, TSurveyRatingQuestion } from "@formbricks/types/surveys";
import { TI18nString } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";

import Dropdown from "./RatingTypeDropdown";

interface RatingQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyRatingQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
  isInvalid: boolean;
}

export default function RatingQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  languages,
}: RatingQuestionFormProps) {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);

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

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <Label htmlFor="subheader">Scale</Label>
          <div className="mt-2">
            <Dropdown
              options={[
                { label: "Number", value: "number", icon: HashtagIcon },
                { label: "Star", value: "star", icon: StarIcon },
                { label: "Smiley", value: "smiley", icon: FaceSmileIcon },
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
                { label: "5 points (recommended)", value: 5 },
                { label: "3 points", value: 3 },
                { label: "4 points", value: 4 },
                { label: "7 points", value: 7 },
                { label: "10 points", value: 10 },
              ]}
              /* disabled={survey.status !== "draft"} */
              defaultValue={question.range || 5}
              onSelect={(option) => updateQuestion(questionIdx, { range: option.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <LocalizedInput
            id="lowerLabel"
            name="lowerLabel"
            value={question.lowerLabel as TI18nString}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            languages={languages}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
          />
        </div>
        <div className="flex-1">
          <LocalizedInput
            id="upperLabel"
            name="upperLabel"
            value={question.upperLabel as TI18nString}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            languages={languages}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
          />
        </div>
      </div>

      <div className="mt-3">
        {!question.required && (
          <div className="flex-1">
            <LocalizedInput
              id="dismissButtonLabel"
              name="dismissButtonLabel"
              value={question.dismissButtonLabel as TI18nString}
              localSurvey={localSurvey}
              questionIdx={questionIdx}
              placeholder={"skip"}
              languages={languages}
              isInvalid={isInvalid}
              updateQuestion={updateQuestion}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
            />
          </div>
        )}
      </div>
    </form>
  );
}
