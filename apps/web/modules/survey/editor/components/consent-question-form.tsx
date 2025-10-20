"use client";

import { type JSX } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyConsentQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";

interface ConsentQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyConsentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyConsentQuestion>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed?: boolean;
}

export const ConsentQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured = true,
  isExternalUrlsAllowed,
}: ConsentQuestionFormProps): JSX.Element => {
  const { t } = useTranslation();

  // Common props shared across all QuestionFormInput components
  const commonInputProps = {
    localSurvey,
    questionIdx,
    isInvalid,
    updateQuestion,
    selectedLanguageCode,
    setSelectedLanguageCode,
    locale,
    isStorageConfigured,
    isExternalUrlsAllowed,
  };

  return (
    <form>
      <QuestionFormInput
        {...commonInputProps}
        id="headline"
        value={question.headline}
        label={t("environments.surveys.edit.question") + "*"}
        autoFocus={!question.headline?.default || question.headline.default.trim() === ""}
      />

      <div className="mt-3">
        <QuestionFormInput
          {...commonInputProps}
          id="subheader"
          value={question.subheader}
          label={t("common.description")}
        />
      </div>

      <QuestionFormInput
        {...commonInputProps}
        id="label"
        label={t("environments.surveys.edit.checkbox_label") + "*"}
        placeholder="I agree to the terms and conditions"
        value={question.label}
      />
    </form>
  );
};
