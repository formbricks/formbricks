"use client";

import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { Button } from "@/modules/ui/components/button";
import { QuestionToggleTable } from "@/modules/ui/components/question-toggle-table";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type JSX, useEffect } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurvey, TSurveyAddressQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface AddressQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyAddressQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyAddressQuestion>) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  contactAttributeKeys: TContactAttributeKey[];
  locale: TUserLocale;
}

export const AddressQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  contactAttributeKeys,
  locale,
}: AddressQuestionFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);
  const t = useTranslations();
  const fields = [
    {
      id: "addressLine1",
      label: t("environments.surveys.edit.address_line_1"),
      ...question.addressLine1,
    },
    {
      id: "addressLine2",
      label: t("environments.surveys.edit.address_line_2"),
      ...question.addressLine2,
    },
    {
      id: "city",
      label: t("environments.surveys.edit.city"),
      ...question.city,
    },
    {
      id: "state",
      label: t("environments.surveys.edit.state"),
      ...question.state,
    },
    {
      id: "zip",
      label: t("environments.surveys.edit.zip"),
      ...question.zip,
    },
    {
      id: "country",
      label: t("environments.surveys.edit.country"),
      ...question.country,
    },
  ];

  useEffect(() => {
    const allFieldsAreOptional = [
      question.addressLine1,
      question.addressLine2,
      question.city,
      question.state,
      question.zip,
      question.country,
    ]
      .filter((field) => field.show)
      .every((field) => !field.required);

    if (allFieldsAreOptional) {
      updateQuestion(questionIdx, { required: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    question.addressLine1,
    question.addressLine2,
    question.city,
    question.state,
    question.zip,
    question.country,
  ]);

  const [parent] = useAutoAnimate();
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
        contactAttributeKeys={contactAttributeKeys}
        locale={locale}
      />

      <div ref={parent}>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
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
                contactAttributeKeys={contactAttributeKeys}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
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

        <QuestionToggleTable
          type="address"
          fields={fields}
          onShowToggle={(field, show) => {
            updateQuestion(questionIdx, {
              [field.id]: {
                show,
                required: field.required,
              },
              // when show changes, and the field is required, the question should be required
              ...(show && field.required && { required: true }),
            });
          }}
          onRequiredToggle={(field, required) => {
            updateQuestion(questionIdx, {
              [field.id]: {
                show: field.show,
                required,
              },
              required: true,
            });
          }}
        />
      </div>
    </form>
  );
};
