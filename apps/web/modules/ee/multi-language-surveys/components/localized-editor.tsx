"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TI18nString, TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { getTextContent, isValidHTML } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { md } from "@/lib/markdownIt";
import { recallToHeadline } from "@/lib/utils/recall";
import { isLabelValidForAllLanguages } from "@/modules/survey/editor/lib/validation";
import { Editor } from "@/modules/ui/components/editor";
import { LanguageIndicator } from "./language-indicator";

interface LocalizedEditorProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  isInvalid: boolean;
  updateQuestion: any;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  questionIdx: number;
  firstRender: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  locale: TUserLocale;
  questionId: string;
  isCard?: boolean; // Flag to indicate if this is a welcome/ending card
  autoFocus?: boolean;
  isExternalUrlsAllowed?: boolean;
}

const checkIfValueIsIncomplete = (
  id: string,
  isInvalid: boolean,
  surveyLanguageCodes: TSurveyLanguage[],
  value?: TI18nString
) => {
  const labelIds = ["subheader", "headline", "html"];
  if (value === undefined) return false;
  const isDefaultIncomplete = labelIds.includes(id)
    ? getTextContent(value.default ?? "").trim() !== ""
    : false;
  return isInvalid && !isLabelValidForAllLanguages(value, surveyLanguageCodes) && isDefaultIncomplete;
};

export function LocalizedEditor({
  id,
  value,
  localSurvey,
  isInvalid,
  updateQuestion,
  selectedLanguageCode,
  setSelectedLanguageCode,
  questionIdx,
  firstRender,
  setFirstRender,
  locale,
  questionId,
  isCard,
  autoFocus,
  isExternalUrlsAllowed,
}: Readonly<LocalizedEditorProps>) {
  const { t } = useTranslation();

  const isInComplete = useMemo(
    () => checkIfValueIsIncomplete(id, isInvalid, localSurvey.languages, value),
    [id, isInvalid, localSurvey.languages, value]
  );

  return (
    <div className="relative w-full">
      <Editor
        id={id}
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        autoFocus={autoFocus}
        getText={() => {
          const text = value ? (value[selectedLanguageCode] ?? "") : "";
          let html = md.render(text);

          // For backwards compatibility: wrap plain text headlines in <strong> tags
          // This ensures old surveys maintain semibold styling when converted to HTML
          if (id === "headline" && text && !isValidHTML(text)) {
            // Use [\s\S]*? to match any character including newlines
            html = html.replaceAll(/<p>([\s\S]*?)<\/p>/g, "<p><strong>$1</strong></p>");
          }

          return html;
        }}
        key={`${questionId}-${id}-${selectedLanguageCode}`}
        setFirstRender={setFirstRender}
        setText={(v: string) => {
          let sanitizedContent = v;
          if (!isExternalUrlsAllowed) {
            sanitizedContent = v.replaceAll(/<a[^>]*>(.*?)<\/a>/gi, "$1");
          }

          // Check if the question still exists before updating
          const currentQuestion = localSurvey.questions[questionIdx];

          // if this is a card, we wanna check if the card exists in the localSurvey
          if (isCard) {
            const isWelcomeCard = questionIdx === -1;
            const isEndingCard = questionIdx >= localSurvey.questions.length;

            // For ending cards, check if the field exists before updating
            if (isEndingCard) {
              const ending = localSurvey.endings.find((ending) => ending.id === questionId);
              // If the field doesn't exist on the ending card, don't create it
              if (!ending || ending[id] === undefined) {
                return;
              }
            }

            // For welcome cards, check if it exists
            if (isWelcomeCard && !localSurvey.welcomeCard) {
              return;
            }

            const translatedContent = {
              ...value,
              [selectedLanguageCode]: sanitizedContent,
            };
            updateQuestion({ [id]: translatedContent });
            return;
          }

          if (currentQuestion && currentQuestion[id] !== undefined) {
            const translatedContent = {
              ...value,
              [selectedLanguageCode]: sanitizedContent,
            };
            updateQuestion(questionIdx, { [id]: translatedContent });
          }
        }}
        localSurvey={localSurvey}
        questionId={questionId}
        selectedLanguageCode={selectedLanguageCode}
        isExternalUrlsAllowed={isExternalUrlsAllowed}
      />
      {localSurvey.languages.length > 1 && (
        <div>
          <LanguageIndicator
            selectedLanguageCode={selectedLanguageCode}
            setFirstRender={setFirstRender}
            setSelectedLanguageCode={setSelectedLanguageCode}
            surveyLanguages={localSurvey.languages}
            locale={locale}
          />

          {value && selectedLanguageCode !== "default" && value.default ? (
            <div className="mt-1 flex text-xs text-gray-500">
              <strong>{t("environments.project.languages.translate")}:</strong>
              <span className="ml-1">
                {getTextContent(recallToHeadline(value, localSurvey, false, "default").default ?? "")}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {isInComplete ? (
        <div className="mt-1 text-xs text-red-400">
          {t("environments.project.languages.incomplete_translations")}
        </div>
      ) : null}
    </div>
  );
}
