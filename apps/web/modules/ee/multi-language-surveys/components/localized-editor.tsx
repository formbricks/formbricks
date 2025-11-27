"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { getTextContent, isValidHTML } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { md } from "@/lib/markdownIt";
import { recallToHeadline } from "@/lib/utils/recall";
import { isLabelValidForAllLanguages } from "@/modules/survey/editor/lib/validation";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { Editor } from "@/modules/ui/components/editor";
import { LanguageIndicator } from "./language-indicator";

interface LocalizedEditorProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  isInvalid: boolean;
  updateElement: any;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  elementIdx: number;
  firstRender: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  locale: TUserLocale;
  elementId: string;
  isCard?: boolean; // Flag to indicate if this is a welcome/ending card
  autoFocus?: boolean;
  isExternalUrlsAllowed?: boolean;
  suppressUpdates?: () => boolean; // Function to check if updates should be suppressed (e.g., during deletion)
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
  updateElement,
  selectedLanguageCode,
  setSelectedLanguageCode,
  elementIdx,
  firstRender,
  setFirstRender,
  locale,
  elementId,
  isCard,
  autoFocus,
  isExternalUrlsAllowed,
  suppressUpdates,
}: Readonly<LocalizedEditorProps>) {
  // Derive elements from blocks for migrated surveys
  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);
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
        key={`${elementId}-${id}-${selectedLanguageCode}`}
        setFirstRender={setFirstRender}
        setText={(v: string) => {
          // Early exit if updates are suppressed (e.g., during deletion)
          // This prevents race conditions where setText fires with stale props before React updates state
          if (suppressUpdates?.()) {
            return;
          }

          let sanitizedContent = v;
          if (!isExternalUrlsAllowed) {
            sanitizedContent = v.replaceAll(/<a[^>]*>(.*?)<\/a>/gi, "$1");
          }

          // Check if the elements still exists before updating
          const currentElement = elements[elementIdx];

          // if this is a card, we wanna check if the card exists in the localSurvey
          if (isCard) {
            const isWelcomeCard = elementIdx === -1;
            const isEndingCard = elementIdx >= elements.length;

            // For ending cards, check if the field exists before updating
            if (isEndingCard) {
              const ending = localSurvey.endings.find((ending) => ending.id === elementId);
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
            updateElement({ [id]: translatedContent });
            return;
          }

          // Check if the field exists on the element (not just if it's not undefined)
          if (currentElement && id in currentElement && currentElement[id] !== undefined) {
            const translatedContent = {
              ...value,
              [selectedLanguageCode]: sanitizedContent,
            };
            updateElement(elementIdx, { [id]: translatedContent });
          }
        }}
        localSurvey={localSurvey}
        elementId={elementId}
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
