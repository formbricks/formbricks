"use client";

import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyCTAElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface CTAQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCTAElement;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyCTAElement>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const CTAQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: CTAQuestionFormProps): JSX.Element => {
  const { t } = useTranslation();

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
        isStorageConfigured={isStorageConfigured}
        autoFocus={!question.headline?.default || question.headline.default.trim() === ""}
        isExternalUrlsAllowed={isExternalUrlsAllowed}
      />

      <div className="mt-3">
        <QuestionFormInput
          id="subheader"
          value={question.subheader}
          label={t("common.description")}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          isInvalid={isInvalid}
          updateQuestion={updateQuestion}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          locale={locale}
          isStorageConfigured={isStorageConfigured}
          isExternalUrlsAllowed={isExternalUrlsAllowed}
        />
      </div>

      <div className="mt-3 flex-1">
        <div className="mt-2 flex flex-col gap-2">
          <QuestionFormInput
            id="ctaButtonLabel"
            value={question.ctaButtonLabel}
            label={t("environments.surveys.edit.next_button_label")}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            maxLength={48}
            placeholder={lastQuestion ? t("common.finish") : t("common.next")}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            locale={locale}
            isStorageConfigured={isStorageConfigured}
          />

          <div>
            <Label htmlFor="buttonLabel">{t("environments.surveys.edit.button_url")}</Label>
            <Input
              id="buttonUrl"
              name="buttonUrl"
              value={question.buttonUrl}
              placeholder="https://website.com"
              onChange={(e) => updateQuestion(questionIdx, { buttonUrl: e.target.value })}
            />
          </div>
        </div>
      </div>
    </form>
  );
};
