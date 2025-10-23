"use client";

import { PlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey, TSurveyEndScreenCard } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { createI18nString, extractLanguageCodes, getLocalizedValue } from "@/lib/i18n/utils";
import { headlineToRecall, recallToHeadline } from "@/lib/utils/recall";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { RecallWrapper } from "@/modules/survey/components/question-form-input/components/recall-wrapper";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface EndScreenFormProps {
  localSurvey: TSurvey;
  endingCardIndex: number;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  updateSurvey: (input: Partial<TSurveyEndScreenCard & { _forceUpdate?: boolean }>) => void;
  endingCard: TSurveyEndScreenCard;
  locale: TUserLocale;
  isStorageConfigured: boolean;
  isExternalUrlsAllowed: boolean;
}

export const EndScreenForm = ({
  localSurvey,
  endingCardIndex,
  isInvalid,
  selectedLanguageCode,
  setSelectedLanguageCode,
  updateSurvey,
  endingCard,
  locale,
  isStorageConfigured,
  isExternalUrlsAllowed,
}: EndScreenFormProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);

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
        locale={locale}
        isStorageConfigured={isStorageConfigured}
        autoFocus={!endingCard.headline?.default || endingCard.headline.default.trim() === ""}
      />
      <div>
        {endingCard.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
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
                locale={locale}
                isStorageConfigured={isStorageConfigured}
                autoFocus={!endingCard.subheader?.default || endingCard.subheader.default.trim() === ""}
              />
            </div>
          </div>
        )}

        {endingCard.subheader === undefined && (
          <Button
            size="sm"
            className="mt-3"
            variant="secondary"
            type="button"
            onClick={() => {
              // Directly update the state, bypassing the guard in updateSurvey
              updateSurvey({
                subheader: createI18nString("", surveyLanguageCodes),
                _forceUpdate: true,
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>
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
                placeholder={t("environments.surveys.edit.create_your_own_survey")}
                className="rounded-md"
                value={endingCard.buttonLabel}
                localSurvey={localSurvey}
                questionIdx={localSurvey.questions.length + endingCardIndex}
                isInvalid={isInvalid}
                updateSurvey={updateSurvey}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("environments.surveys.edit.button_url")}</Label>
              <div className="rounded-md bg-white">
                <RecallWrapper
                  value={endingCard.buttonLink ?? ""}
                  questionId={endingCard.id}
                  onChange={(val, recallItems, fallbacks) => {
                    const updatedValue = {
                      ...endingCard,
                      buttonLink:
                        recallItems && fallbacks ? headlineToRecall(val, recallItems, fallbacks) : val,
                    };

                    updateSurvey(updatedValue);
                  }}
                  onAddFallback={() => {
                    inputRef.current?.focus();
                  }}
                  isRecallAllowed
                  localSurvey={localSurvey}
                  usedLanguageCode={"default"}
                  render={({ value, onChange, highlightedJSX, children }) => {
                    return (
                      <div className="group relative">
                        {/* The highlight container is absolutely positioned behind the input */}
                        <div
                          className={`no-scrollbar absolute top-0 z-0 mt-0.5 flex h-10 w-full overflow-scroll whitespace-nowrap px-3 py-2 text-center text-sm text-transparent`}
                          dir="auto"
                          key={highlightedJSX.toString()}>
                          {highlightedJSX}
                        </div>
                        <Input
                          ref={inputRef}
                          id="buttonLink"
                          name="buttonLink"
                          className={`relative text-black caret-black ${!isExternalUrlsAllowed ? "cursor-not-allowed opacity-50" : ""}`}
                          placeholder="https://formbricks.com"
                          value={
                            recallToHeadline(
                              {
                                [selectedLanguageCode]: value,
                              },
                              localSurvey,
                              false,
                              "default"
                            )[selectedLanguageCode]
                          }
                          onChange={(e) => isExternalUrlsAllowed && onChange(e.target.value)}
                          disabled={!isExternalUrlsAllowed}
                        />
                        {children}
                      </div>
                    );
                  }}
                />
              </div>
              {!isExternalUrlsAllowed && (
                <p className="text-xs text-slate-500">
                  {t("environments.surveys.edit.external_urls_paywall_tooltip")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  );
};
