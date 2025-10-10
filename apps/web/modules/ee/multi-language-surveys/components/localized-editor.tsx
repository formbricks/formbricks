"use client";

import { useTranslate } from "@tolgee/react";
import DOMPurify from "dompurify";
import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import type { TI18nString, TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { isValidHTML } from "@formbricks/types/surveys/validation";
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
}

const checkIfValueIsIncomplete = (
  id: string,
  isInvalid: boolean,
  surveyLanguageCodes: TSurveyLanguage[],
  value?: TI18nString
) => {
  const labelIds = ["subheader", "headline", "html"];
  if (value === undefined) return false;
  const isDefaultIncomplete = labelIds.includes(id) ? value.default.trim() !== "" : false;
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
}: Readonly<LocalizedEditorProps>) {
  const { t } = useTranslate();

  const isInComplete = useMemo(
    () => checkIfValueIsIncomplete(id, isInvalid, localSurvey.languages, value),
    [id, isInvalid, localSurvey.languages, value]
  );

  return (
    <div className="relative w-full">
      <Editor
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        getText={() => {
          const text = value ? (value[selectedLanguageCode] ?? "") : "";
          let html = md.render(text);

          // For backwards compatibility: wrap plain text headlines in <strong> tags
          // This ensures old surveys maintain semibold styling when converted to HTML
          if (id === "headline" && text && !isValidHTML(text)) {
            // Use [\s\S]*? to match any character including newlines
            html = html.replace(/<p>([\s\S]*?)<\/p>/g, "<p><strong>$1</strong></p>");
          }

          return html;
        }}
        key={`${questionId}-${id}-${selectedLanguageCode}`}
        setFirstRender={setFirstRender}
        setText={(v: string) => {
          // Check if the question still exists before updating
          const currentQuestion = localSurvey.questions[questionIdx];
          const isWelcomeCard = questionIdx === -1;
          const isEndingCard = questionIdx >= localSurvey.questions.length;
          if ((currentQuestion && currentQuestion[id] !== undefined) || isWelcomeCard || isEndingCard) {
            const translatedContent = {
              ...value,
              [selectedLanguageCode]: v,
            };
            if (isWelcomeCard || isEndingCard) {
              updateQuestion({ [id]: translatedContent });
              return;
            }
            updateQuestion(questionIdx, { [id]: translatedContent });
          }
        }}
        localSurvey={localSurvey}
        questionId={questionId}
        selectedLanguageCode={selectedLanguageCode}
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
              <span
                className="fb-htmlbody ml-1" // styles are in global.css
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    recallToHeadline(value, localSurvey, false, "default").default ?? ""
                  ),
                }}
              />
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
