"use client";

import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyEndScreenCard } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface EndScreenFormProps {
  localSurvey: TSurvey;
  endingCardIndex: number;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  attributeClasses: TAttributeClass[];
  updateSurvey: (input: Partial<TSurveyEndScreenCard>) => void;
  endingCard: TSurveyEndScreenCard;
  locale: TUserLocale;
  defaultRedirect: string;
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
  defaultRedirect,
  locale,
}: EndScreenFormProps) => {
  const t = useTranslations();
  const [showEndingCardCTA, setshowEndingCardCTA] = useState<boolean>(
    endingCard.type === "endScreen" &&
      (!!getLocalizedValue(endingCard.buttonLabel, selectedLanguageCode) || !!endingCard.buttonLink)
  );

  useEffect(() => {
    if (!endingCard.buttonLink) {
      updateSurvey({ buttonLink: defaultRedirect });
    }
  }, [endingCard.buttonLink, defaultRedirect, updateSurvey]);

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
        locale={locale}
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
        locale={locale}
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
                  buttonLabel: { default: t("environments.surveys.edit.take_more_surveys") },
                  buttonLink: defaultRedirect,
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
                placeholder={t("environments.surveys.edit.take_more_surveys")}
                className="bg-white"
                value={endingCard.buttonLabel}
                localSurvey={localSurvey}
                questionIdx={localSurvey.questions.length + endingCardIndex}
                isInvalid={isInvalid}
                updateSurvey={updateSurvey}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
                locale={locale}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("environments.surveys.edit.button_url")}</Label>
              <Input
                id="buttonLink"
                name="buttonLink"
                className="bg-white"
                placeholder="https://member.digiopinion.com/overview"
                value={endingCard.buttonLink ?? defaultRedirect}
                onChange={(e) => updateSurvey({ buttonLink: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
};
