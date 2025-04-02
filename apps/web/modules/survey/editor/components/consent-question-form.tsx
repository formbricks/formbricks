"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { useTranslate } from "@tolgee/react";
import { type JSX } from "react";
import { TSurvey, TSurveyConsentQuestion } from "@formbricks/types/surveys/types";

interface ConsentQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyConsentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyConsentQuestion>) => void;
  selectedLanguageCode: string;
  isInvalid: boolean;
}

export const ConsentQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
}: ConsentQuestionFormProps): JSX.Element => {
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
      />
    </form>
  );
};
