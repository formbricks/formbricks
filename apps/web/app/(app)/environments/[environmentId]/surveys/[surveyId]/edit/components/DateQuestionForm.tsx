import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { createI18nString } from "@formbricks/ee/multiLanguage/utils/i18n";
import { TI18nString, TSurvey, TSurveyDateQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { OptionsSwitcher } from "@formbricks/ui/QuestionTypeSelector";

interface IDateQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyDateQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
  isInvalid: boolean;
}

const dateOptions = [
  {
    value: "M-d-y",
    label: "MM-DD-YYYY",
  },
  {
    value: "d-M-y",
    label: "DD-MM-YYYY",
  },
  {
    value: "y-M-d",
    label: "YYYY-MM-DD",
  },
];

export default function DateQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  languages,
}: IDateQuestionFormProps): JSX.Element {
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
            className="mt-3"
            variant="minimal"
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

      <div className="mt-3">
        <Label htmlFor="questionType">Date Format</Label>
        <div className="mt-2 flex items-center">
          <OptionsSwitcher
            options={dateOptions}
            currentOption={question.format}
            handleTypeChange={(value) => updateQuestion(questionIdx, { format: value })}
          />
        </div>
      </div>
    </form>
  );
}
