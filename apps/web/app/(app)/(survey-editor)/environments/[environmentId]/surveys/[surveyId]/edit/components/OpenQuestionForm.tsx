"use client";

import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { HashIcon, LinkIcon, MailIcon, MessageSquareTextIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { JSX } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { OptionsSwitch } from "@formbricks/ui/components/OptionsSwitch";

const questionTypes = [
  { value: "text", label: "common.text", icon: <MessageSquareTextIcon className="h-4 w-4" /> },
  { value: "email", label: "common.email", icon: <MailIcon className="h-4 w-4" /> },
  { value: "url", label: "common.url", icon: <LinkIcon className="h-4 w-4" /> },
  { value: "number", label: "common.number", icon: <HashIcon className="h-4 w-4" /> },
  { value: "phone", label: "common.phone", icon: <PhoneIcon className="h-4 w-4" /> },
];

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyOpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyOpenTextQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  contactAttributeKeys: TContactAttributeKey[];
  locale: TUserLocale;
}

export const OpenQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  contactAttributeKeys,
  locale,
}: OpenQuestionFormProps): JSX.Element => {
  const t = useTranslations();
  const defaultPlaceholder = getPlaceholderByInputType(question.inputType ?? "text");
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);
  const handleInputChange = (inputType: TSurveyOpenTextQuestionInputType) => {
    const updatedAttributes = {
      inputType: inputType,
      placeholder: createI18nString(getPlaceholderByInputType(inputType), surveyLanguageCodes),
      longAnswer: inputType === "text" ? question.longAnswer : false,
    };
    updateQuestion(questionIdx, updatedAttributes);
  };

  const [parent] = useAutoAnimate();

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
        contactAttributeKeys={contactAttributeKeys}
        label={t("environments.surveys.edit.question") + "*"}
        locale={locale}
      />

      <div ref={parent}>
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
                contactAttributeKeys={contactAttributeKeys}
                label={t("common.description")}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
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
      </div>
      <div className="mt-2">
        <QuestionFormInput
          id="placeholder"
          value={
            question.placeholder
              ? question.placeholder
              : createI18nString(defaultPlaceholder, surveyLanguageCodes)
          }
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          isInvalid={isInvalid}
          updateQuestion={updateQuestion}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          contactAttributeKeys={contactAttributeKeys}
          label={t("common.placeholder")}
          locale={locale}
        />
      </div>

      {/* Add a dropdown to select the question type */}
      <div className="mt-3">
        <Label htmlFor="questionType">{t("common.input_type")}</Label>
        <div className="mt-2 flex items-center">
          <OptionsSwitch
            options={questionTypes}
            currentOption={question.inputType}
            handleOptionChange={handleInputChange} // Use the merged function
          />
        </div>
      </div>
    </form>
  );
};

const getPlaceholderByInputType = (inputType: TSurveyOpenTextQuestionInputType) => {
  switch (inputType) {
    case "email":
      return "example@email.com";
    case "url":
      return "http://...";
    case "number":
      return "42";
    case "phone":
      return "+1 123 456 789";
    default:
      return "Type your answer here...";
  }
};
