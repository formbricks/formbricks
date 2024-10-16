"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LocalizedEditor } from "@formbricks/ee/multi-language/components/localized-editor";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyCTAQuestion } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { OptionsSwitch } from "@formbricks/ui/components/OptionsSwitch";
import { QuestionFormInput } from "@formbricks/ui/components/QuestionFormInput";

const options = [
  {
    value: "internal",
    label: "environments.surveys.edit.button_to_continue_in_survey",
  },
  { value: "external", label: "environments.surveys.edit.button_to_link_to_external_url" },
];

interface CTAQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCTAQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyCTAQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
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
  attributeClasses,
}: CTAQuestionFormProps): JSX.Element => {
  const [firstRender, setFirstRender] = useState(true);
  const t = useTranslations();
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
          />
        </div>
      </div>
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
            placeholder={lastQuestion ? "Finish" : "Next"}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            attributeClasses={attributeClasses}
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
              attributeClasses={attributeClasses}
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
            attributeClasses={attributeClasses}
          />
        </div>
      )}
    </form>
  );
};
