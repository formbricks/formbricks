"use client";

import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { HashIcon, LinkIcon, MailIcon, MessageSquareTextIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { JSX, useEffect, useState } from "react";
import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyOpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyOpenTextQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
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
  locale,
}: OpenQuestionFormProps): JSX.Element => {
  const { t } = useTranslate();
  const questionTypes = [
    { value: "text", label: t("common.text"), icon: <MessageSquareTextIcon className="h-4 w-4" /> },
    { value: "email", label: t("common.email"), icon: <MailIcon className="h-4 w-4" /> },
    { value: "url", label: t("common.url"), icon: <LinkIcon className="h-4 w-4" /> },
    { value: "number", label: t("common.number"), icon: <HashIcon className="h-4 w-4" /> },
    { value: "phone", label: t("common.phone"), icon: <PhoneIcon className="h-4 w-4" /> },
  ];
  const defaultPlaceholder = getPlaceholderByInputType(question.inputType ?? "text");
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

  const [showCharLimits, setShowCharLimits] = useState(question.inputType === "text");

  const handleInputChange = (inputType: TSurveyOpenTextQuestionInputType) => {
    const updatedAttributes = {
      inputType: inputType,
      placeholder: createI18nString(getPlaceholderByInputType(inputType), surveyLanguageCodes),
      longAnswer: inputType === "text" ? question.longAnswer : false,
      charLimit: {
        min: undefined,
        max: undefined,
      },
    };
    setIsCharLimitEnabled(false);
    setShowCharLimits(inputType === "text");
    updateQuestion(questionIdx, updatedAttributes);
  };

  const [parent] = useAutoAnimate();
  const [isCharLimitEnabled, setIsCharLimitEnabled] = useState(false);

  useEffect(() => {
    if (question?.charLimit?.min !== undefined || question?.charLimit?.max !== undefined) {
      setIsCharLimitEnabled(true);
    } else {
      setIsCharLimitEnabled(false);
    }
  }, []);

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
                label={t("common.description")}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
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
      <div className="mt-3">
        {showCharLimits && (
          <AdvancedOptionToggle
            isChecked={isCharLimitEnabled}
            onToggle={(checked: boolean) => {
              setIsCharLimitEnabled(checked);
              updateQuestion(questionIdx, {
                charLimit: {
                  enabled: checked,
                  min: undefined,
                  max: undefined,
                },
              });
            }}
            htmlId="charLimit"
            description={t("environments.surveys.edit.character_limit_toggle_description")}
            childBorder
            title={t("environments.surveys.edit.character_limit_toggle_title")}
            customContainerClass="p-0">
            <div className="flex gap-4 p-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="minLength">{t("common.minimum")}</Label>
                <Input
                  id="minLength"
                  name="minLength"
                  type="number"
                  min={0}
                  value={question?.charLimit?.min || ""}
                  aria-label={t("common.minimum")}
                  className="bg-white"
                  onChange={(e) =>
                    updateQuestion(questionIdx, {
                      charLimit: {
                        ...question?.charLimit,
                        min: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="maxLength">{t("common.maximum")}</Label>
                <Input
                  id="maxLength"
                  name="maxLength"
                  type="number"
                  min={0}
                  aria-label={t("common.maximum")}
                  value={question?.charLimit?.max || ""}
                  className="bg-white"
                  onChange={(e) =>
                    updateQuestion(questionIdx, {
                      charLimit: {
                        ...question?.charLimit,
                        max: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          </AdvancedOptionToggle>
        )}
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
