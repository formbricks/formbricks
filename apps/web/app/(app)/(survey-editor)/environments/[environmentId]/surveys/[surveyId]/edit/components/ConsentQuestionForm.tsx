"use client";

import { LocalizedEditor } from "@/modules/ee/multi-language-surveys/components/localized-editor";
import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { Label } from "@/modules/ui/components/label";
import { useTranslations } from "next-intl";
import { type JSX, useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
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
  contactAttributeKeys: TContactAttributeKey[];
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
  contactAttributeKeys,
  locale,
}: ConsentQuestionFormProps): JSX.Element => {
  const [firstRender, setFirstRender] = useState(true);
  const t = useTranslations();
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
        contactAttributeKeys={contactAttributeKeys}
        locale={locale}
      />

      <div className="mt-3">
        <Label htmlFor="subheader">{t("common.description")}</Label>
        <div className="mt-2">
          <LocalizedEditor
            id="subheader"
            value={question.html}
            localSurvey={localSurvey}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            firstRender={firstRender}
            setFirstRender={setFirstRender}
            questionIdx={questionIdx}
            locale={locale}
          />
        </div>
      </div>

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
        contactAttributeKeys={contactAttributeKeys}
        locale={locale}
      />
    </form>
  );
};
