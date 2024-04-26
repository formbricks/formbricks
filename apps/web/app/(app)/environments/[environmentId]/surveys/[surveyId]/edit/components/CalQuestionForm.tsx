import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TSurvey, TSurveyCalQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";

interface CalQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCalQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyCalQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
}

export const CalQuestionForm = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
}: CalQuestionFormProps): JSX.Element => {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
      />
      <div>
        {showSubheader && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
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
                subheader: createI18nString("", surveyLanguageCodes),
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
};
