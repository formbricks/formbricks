"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyEndScreenCard } from "@formbricks/types/surveys/types";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { QuestionFormInput } from "@formbricks/ui/components/QuestionFormInput";
import { Switch } from "@formbricks/ui/components/Switch";

interface EndScreenFormProps {
  localSurvey: TSurvey;
  endingCardIndex: number;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  attributeClasses: TAttributeClass[];
  updateSurvey: (input: Partial<TSurveyEndScreenCard>) => void;
  endingCard: TSurveyEndScreenCard;
}

export const EndScreenForm = ({
  localSurvey,
  endingCardIndex,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
  updateSurvey,
  endingCard,
}: EndScreenFormProps) => {
  const t = useTranslations();
  const [showEndingCardCTA, setshowEndingCardCTA] = useState<boolean>(
    endingCard.type === "endScreen" &&
      (!!getLocalizedValue(endingCard.buttonLabel, selectedLanguageCode) || !!endingCard.buttonLink)
  );
  return (
    <form>
      <QuestionFormInput
        id="headline"
        label={t("common.note") + "*"}
        value={endingCard.headline}
        localSurvey={localSurvey}
        questionIdx={localSurvey.questions.length + endingCardIndex}
        isInvalid={isInvalid}
        updateSurvey={updateSurvey}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />

      <QuestionFormInput
        id="subheader"
        value={endingCard.subheader}
        label={t("common.description")}
        localSurvey={localSurvey}
        questionIdx={localSurvey.questions.length + endingCardIndex}
        isInvalid={isInvalid}
        updateSurvey={updateSurvey}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />
      <div className="mt-4">
        <div className="flex items-center space-x-1">
          <Switch
            id="showButton"
            checked={showEndingCardCTA}
            onCheckedChange={() => {
              if (showEndingCardCTA) {
                updateSurvey({ buttonLabel: undefined, buttonLink: undefined });
              } else {
                updateSurvey({
                  buttonLabel: { default: t("environments.surveys.edit.create_your_own_survey") },
                  buttonLink: "https://formbricks.com",
                });
              }
              setshowEndingCardCTA(!showEndingCardCTA);
            }}
          />
          <Label htmlFor="showButton" className="cursor-pointer">
            <div className="ml-2">
              <h3 className="text-sm font-semibold text-slate-700">
                {t("environments.surveys.edit.show_button")}
              </h3>
              <p className="text-xs font-normal text-slate-500">
                {t("environments.surveys.edit.send_your_respondents_to_a_page_of_your_choice")}
              </p>
            </div>
          </Label>
        </div>
        {showEndingCardCTA && (
          <div className="border-1 mt-4 space-y-4 rounded-md border bg-slate-100 p-4 pt-2">
            <div className="space-y-2">
              <QuestionFormInput
                id="buttonLabel"
                label={t("environments.surveys.edit.button_label")}
                placeholder="Create your own Survey"
                className="bg-white"
                value={endingCard.buttonLabel}
                localSurvey={localSurvey}
                questionIdx={localSurvey.questions.length + endingCardIndex}
                isInvalid={isInvalid}
                updateSurvey={updateSurvey}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("environments.surveys.edit.button_url")}</Label>
              <Input
                id="buttonLink"
                name="buttonLink"
                className="bg-white"
                placeholder="https://formbricks.com"
                value={endingCard.buttonLink}
                onChange={(e) => updateSurvey({ buttonLink: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
};
