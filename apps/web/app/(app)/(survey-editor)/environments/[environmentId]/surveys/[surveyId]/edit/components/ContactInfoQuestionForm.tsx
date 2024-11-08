"use client";

import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyContactInfoQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import { QuestionToggleTable } from "@formbricks/ui/components/QuestionToggleTable";

interface ContactInfoQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyContactInfoQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyContactInfoQuestion>) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  attributeClasses: TAttributeClass[];
  locale: TUserLocale;
}

export const ContactInfoQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
  locale,
}: ContactInfoQuestionFormProps): JSX.Element => {
  const t = useTranslations();
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

  const fields = [
    {
      id: "firstName",
      label: t("environments.surveys.edit.first_name"),
      ...question.firstName,
    },
    {
      id: "lastName",
      label: t("environments.surveys.edit.last_name"),
      ...question.lastName,
    },
    {
      id: "email",
      label: t("common.email"),
      ...question.email,
    },
    {
      id: "phone",
      label: t("common.phone"),
      ...question.phone,
    },
    {
      id: "company",
      label: t("environments.surveys.edit.company"),
      ...question.company,
    },
  ];

  useEffect(() => {
    const allFieldsAreOptional = [
      question.firstName,
      question.lastName,
      question.email,
      question.phone,
      question.company,
    ]
      .filter((field) => field.show)
      .every((field) => !field.required);

    if (allFieldsAreOptional) {
      updateQuestion(questionIdx, { required: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.firstName, question.lastName, question.email, question.phone, question.company]);

  // Auto animate
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
        attributeClasses={attributeClasses}
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
                attributeClasses={attributeClasses}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="minimal"
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
          type="contact"
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
