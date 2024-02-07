import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { createI18nString, extractLanguageIds } from "@formbricks/lib/i18n/utils";
import { TLanguage } from "@formbricks/types/product";
import { TSurvey, TSurveyCalQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface CalQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCalQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  surveyLanguages: TLanguage[];
  isInvalid: boolean;
  defaultLanguageSymbol: string;
}

export default function CalQuestionForm({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  selectedLanguage,
  setSelectedLanguage,
  surveyLanguages,
  isInvalid,
  defaultLanguageSymbol,
}: CalQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const surveyLanguageIds = extractLanguageIds(surveyLanguages);

  return (
    <form>
      <LocalizedInput
        id="headline"
        name="headline"
        value={question.headline}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        surveyLanguages={surveyLanguages}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        defaultLanguageSymbol={defaultLanguageSymbol}
      />
      <div>
        {showSubheader && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <LocalizedInput
                id="subheader"
                name="subheader"
                value={question.subheader}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                surveyLanguages={surveyLanguages}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
                defaultLanguageSymbol={defaultLanguageSymbol}
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
                subheader: createI18nString("", surveyLanguageIds, defaultLanguageSymbol),
              });
              setShowSubheader(true);
            }}>
            {" "}
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
        <div className="mt-3">
          <Label htmlFor="calUserName">Add your Cal.com username or username/event</Label>
          <div className="mt-2">
            <Input
              id="calUserName"
              name="calUserName"
              value={question.calUserName}
              onChange={(e) => updateQuestion(questionIdx, { calUserName: e.target.value })}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
