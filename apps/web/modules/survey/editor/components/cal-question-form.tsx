"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { type JSX, useEffect, useState } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TSurvey, TSurveyCalQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface CalQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCalQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyCalQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
}

export const CalQuestionForm = ({
  localSurvey,
  question,
  questionIdx,
  updateQuestion,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  locale,
}: CalQuestionFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  const [isCalHostEnabled, setIsCalHostEnabled] = useState(!!question.calHost);
  const { t } = useTranslate();
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
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
      />
      <div>
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mr-3 mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
        {question.tooltip === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                tooltip: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_tooltip")}
          </Button>
        )}
        {question.subheader !== undefined && (
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
                label={t("common.description")}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.tooltip !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="tooltip"
                value={question.tooltip}
                label={t("environments.surveys.edit.tooltip")}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
              />
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="calUserName">{t("environments.surveys.edit.cal_username")}</Label>
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
            description={t("environments.surveys.edit.needed_for_self_hosted_cal_com_instance")}
            childBorder
            title={t("environments.surveys.edit.custom_hostname")}
            customContainerClass="p-0">
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="calHost">{t("environments.surveys.edit.hostname")}</Label>
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
