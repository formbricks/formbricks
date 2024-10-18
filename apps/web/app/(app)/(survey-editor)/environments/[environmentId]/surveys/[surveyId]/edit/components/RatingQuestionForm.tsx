import { HashIcon, PlusIcon, SmileIcon, StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyRatingQuestion } from "@formbricks/types/surveys/types";
import { AdvancedOptionToggle } from "@formbricks/ui/components/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/components/Button";
import { Label } from "@formbricks/ui/components/Label";
import { QuestionFormInput } from "@formbricks/ui/components/QuestionFormInput";
import { Dropdown } from "./RatingTypeDropdown";

interface RatingQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyRatingQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
}

export const RatingQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: RatingQuestionFormProps) => {
  const t = useTranslations();
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

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

      <div>
        {question.subheader !== undefined && (
          <div className="mt-2 inline-flex w-full items-center">
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

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex-1">
          <Label htmlFor="subheader">{t("environments.surveys.edit.scale")}</Label>
          <div className="mt-2">
            <Dropdown
              options={[
                { label: "Number", value: "number", icon: HashIcon },
                { label: "Star", value: "star", icon: StarIcon },
                { label: "Smiley", value: "smiley", icon: SmileIcon },
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
                { label: "5 points (recommended)", value: 5 },
                { label: "3 points", value: 3 },
                { label: "4 points", value: 4 },
                { label: "7 points", value: 7 },
                { label: "10 points", value: 10 },
              ]}
              /* disabled={survey.status !== "draft"} */
              defaultValue={question.range || 5}
              onSelect={(option) => updateQuestion(questionIdx, { range: option.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-between gap-8">
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
            attributeClasses={attributeClasses}
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
            attributeClasses={attributeClasses}
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
              attributeClasses={attributeClasses}
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
