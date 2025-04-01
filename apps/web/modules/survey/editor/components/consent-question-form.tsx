"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Label } from "@/modules/ui/components/label";
import { useTranslate } from "@tolgee/react";
import { type JSX, useState } from "react";
import { TSurvey, TSurveyConsentQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface ConsentQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyConsentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyConsentQuestion>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
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
}: ConsentQuestionFormProps): JSX.Element => {
  const [firstRender, setFirstRender] = useState(true);
  const { t } = useTranslate();
  return (
    <form>
      <QuestionFormInput
        id="headline"
        label={t("environments.surveys.edit.question") + "*"}
        value={question.headline}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
      />
      <QuestionFormInput
        id="label"
        label={t("environments.surveys.edit.checkbox_label") + "*"}
        placeholder="I agree to the terms and conditions"
        value={question.label}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
      />
    </form>
  );
};
