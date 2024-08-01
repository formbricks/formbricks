import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyCalQuestion } from "@formbricks/types/surveys/types";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
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
  attributeClasses: TAttributeClass[];
}

export const CalQuestionForm = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  attributeClasses,
}: CalQuestionFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const [isCalHostEnabled, setIsCalHostEnabled] = useState(!!question.calHost);

  useEffect(() => {
    if (!isCalHostEnabled) {
      updateQuestion(questionIdx, { calHost: undefined });
    } else {
      updateQuestion(questionIdx, { calHost: question.calHost ?? "cal.com" });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalHostEnabled]);

  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={"Question*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />
      <div>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={"Description"}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            className="mt-3"
            variant="minimal"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            {" "}
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
        <div className="mt-3 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="calUserName">Cal.com username or username/event</Label>
            <div>
              <Input
                id="calUserName"
                name="calUserName"
                value={question.calUserName}
                onChange={(e) => updateQuestion(questionIdx, { calUserName: e.target.value })}
              />
            </div>
          </div>

          <AdvancedOptionToggle
            isChecked={isCalHostEnabled}
            onToggle={(checked: boolean) => setIsCalHostEnabled(checked)}
            htmlId="calHost"
            description="Needed for a self-hosted Cal.com instance"
            childBorder
            title="Custom hostname"
            customContainerClass="p-0">
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="calHost">Hostname</Label>
                <Input
                  id="calHost"
                  name="calHost"
                  placeholder="my-cal-instance.com"
                  value={question.calHost}
                  className="bg-white"
                  onChange={(e) => updateQuestion(questionIdx, { calHost: e.target.value })}
                />
              </div>
            </div>
          </AdvancedOptionToggle>
        </div>
      </div>
    </form>
  );
};
