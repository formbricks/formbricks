"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { type JSX, useState } from "react";
import { TSurvey, TSurveyCTAQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface CTAQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCTAQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyCTAQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
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
}: CTAQuestionFormProps): JSX.Element => {
  const { t } = useTranslate();
  const options = [
    {
      value: "internal",
      label: t("environments.surveys.edit.button_to_continue_in_survey"),
    },
    { value: "external", label: t("environments.surveys.edit.button_to_link_to_external_url") },
  ];
  const [firstRender, setFirstRender] = useState(true);
  const [parent] = useAutoAnimate();
  return (
    <form ref={parent}>
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
      />
      <div className="mt-3">
        <OptionsSwitch
          options={options}
          currentOption={question.buttonExternal ? "external" : "internal"}
          handleOptionChange={(e) => updateQuestion(questionIdx, { buttonExternal: e === "external" })}
        />
      </div>

      <div className="mt-2 flex justify-between gap-8">
        <div className="flex w-full space-x-2">
          <QuestionFormInput
            id="buttonLabel"
            value={question.buttonLabel}
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
          />

          {questionIdx !== 0 && (
            <QuestionFormInput
              id="backButtonLabel"
              value={question.backButtonLabel}
              label={t("environments.surveys.edit.back_button_label")}
              localSurvey={localSurvey}
              questionIdx={questionIdx}
              maxLength={48}
              placeholder={"Back"}
              isInvalid={isInvalid}
              updateQuestion={updateQuestion}
              selectedLanguageCode={selectedLanguageCode}
              setSelectedLanguageCode={setSelectedLanguageCode}
              locale={locale}
            />
          )}
        </div>
      </div>

      {question.buttonExternal && (
        <div className="mt-3 flex-1">
          <Label htmlFor="buttonLabel">{t("environments.surveys.edit.button_url")}</Label>
          <div className="mt-2">
            <Input
              id="buttonUrl"
              name="buttonUrl"
              value={question.buttonUrl}
              placeholder="https://website.com"
              onChange={(e) => updateQuestion(questionIdx, { buttonUrl: e.target.value })}
            />
          </div>
        </div>
      )}

      {!question.required && (
        <div className="mt-2">
          <QuestionFormInput
            id="dismissButtonLabel"
            value={question.dismissButtonLabel}
            label={t("environments.surveys.edit.skip_button_label")}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            placeholder={"skip"}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            locale={locale}
          />
        </div>
      )}
    </form>
  );
};
