"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Button } from "@/modules/ui/components/button";
// import { QuestionToggleTable } from "@/modules/ui/components/question-toggle-table";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { type JSX, useEffect } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TSurvey, TSurveyDeployTokenQuestion } from "@formbricks/types/surveys/types";
import { QuestionToggleTable } from "@/modules/ui/components/question-toggle-table";

interface DeployTokenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyDeployTokenQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyDeployTokenQuestion>) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
  selectedLanguageCode: string;
}

export const DeployTokenQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
}: DeployTokenQuestionFormProps): JSX.Element => {
  const { t } = useTranslate();
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

  const fields = [
    {
      id: "tokenName",
      label: t("environments.surveys.edit.token_name"),
      ...question.tokenName,
    },
    {
      id: "tokenSymbol",
      label: t("environments.surveys.edit.token_symbol"),
      ...question.tokenSymbol,
    },
    {
      id: "initialSupply",
      label: t("environments.surveys.edit.initial_supply"),
      ...question.initialSupply,
    },
  ];

  useEffect(() => {
    const allFieldsAreOptional = [
      question.tokenName,
      question.tokenSymbol,
      question.initialSupply,
    ]
      .filter((field) => field.show)
      .every((field) => !field.required);

    updateQuestion(questionIdx, { required: !allFieldsAreOptional });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ question.tokenName, question.tokenSymbol, question.initialSupply]);

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
          type="token"
          fields={fields}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          isInvalid={isInvalid}
          updateQuestion={updateQuestion}
          selectedLanguageCode={selectedLanguageCode}
        />
      </div>
    </form>
  );
};
