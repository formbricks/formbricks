"use client";

import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Dropdown } from "@/modules/survey/editor/components/rating-type-dropdown";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { HashIcon, PlusIcon, SmileIcon, StarIcon } from "lucide-react";
import { TSurvey, TSurveyRatingQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface RatingQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyRatingQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
}

export const RatingQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
}: RatingQuestionFormProps) => {
  // [UseTusk]

  const { t } = useTranslate();
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
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

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <Label htmlFor="subheader">{t("environments.surveys.edit.scale")}</Label>
          <div className="mt-2">
            <Dropdown
              options={[
                { label: t("environments.surveys.edit.number"), value: "number", icon: HashIcon },
                { label: t("environments.surveys.edit.star"), value: "star", icon: StarIcon },
                { label: t("environments.surveys.edit.smiley"), value: "smiley", icon: SmileIcon },
              ]}
              defaultValue={question.scale || "number"}
              onSelect={(option) => {
                if (option.value === "star") {
                  updateQuestion(questionIdx, { scale: option.value, isColorCodingEnabled: false });
                  return;
                }
                updateQuestion(questionIdx, { scale: option.value });
              }}
            />
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor="subheader">{t("environments.surveys.edit.range")}</Label>
          <div className="mt-2">
            <Dropdown
              options={[
                { label: t("environments.surveys.edit.five_points_recommended"), value: 5 },
                { label: t("environments.surveys.edit.three_points"), value: 3 },
                { label: t("environments.surveys.edit.four_points"), value: 4 },
                { label: t("environments.surveys.edit.seven_points"), value: 7 },
                { label: t("environments.surveys.edit.ten_points"), value: 10 },
              ]}
              /* disabled={survey.status !== "draft"} */
              defaultValue={question.range || 5}
              onSelect={(option) => updateQuestion(questionIdx, { range: option.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-8">
        <div className="flex-1">
          <QuestionFormInput
            id="lowerLabel"
            placeholder="Not good"
            value={question.lowerLabel}
            label={t("environments.surveys.edit.lower_label")}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            locale={locale}
          />
        </div>
        <div className="flex-1">
          <QuestionFormInput
            id="upperLabel"
            placeholder="Very satisfied"
            value={question.upperLabel}
            label={t("environments.surveys.edit.upper_label")}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            locale={locale}
          />
        </div>
      </div>

      <div className="mt-3">
        {!question.required && (
          <div className="flex-1">
            <QuestionFormInput
              id="buttonLabel"
              value={question.buttonLabel}
              label={t("environments.surveys.edit.next_button_label")}
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
      </div>

      {question.scale !== "star" && (
        <AdvancedOptionToggle
          isChecked={question.isColorCodingEnabled}
          onToggle={() =>
            updateQuestion(questionIdx, { isColorCodingEnabled: !question.isColorCodingEnabled })
          }
          htmlId="isColorCodingEnabled"
          title={t("environments.surveys.edit.add_color_coding")}
          description={t("environments.surveys.edit.add_color_coding_description")}
          childBorder
          customContainerClass="p-0 mt-4"
        />
      )}
    </form>
  );
};
