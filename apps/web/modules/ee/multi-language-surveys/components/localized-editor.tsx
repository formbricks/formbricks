"use client";

import { extractLanguageCodes, isLabelValidForAllLanguages } from "@/lib/i18n/utils";
import { md } from "@/lib/markdownIt";
import { recallToHeadline } from "@/lib/utils/recall";
import { Editor } from "@/modules/ui/components/editor";
import { useTranslate } from "@tolgee/react";
import DOMPurify from "dompurify";
import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";
import type { TI18nString, TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
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
}

const checkIfValueIsIncomplete = (
  id: string,
  isInvalid: boolean,
  surveyLanguageCodes: string[],
  value?: TI18nString
) => {
  const labelIds = ["subheader"];
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
}: LocalizedEditorProps) {
  const { t } = useTranslate();
  const surveyLanguageCodes = useMemo(
    () => extractLanguageCodes(localSurvey.languages),
    [localSurvey.languages]
  );
  const isInComplete = useMemo(
    () => checkIfValueIsIncomplete(id, isInvalid, surveyLanguageCodes, value),
    [id, isInvalid, surveyLanguageCodes, value]
  );

  return (
    <div className="relative w-full">
      <Editor
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        getText={() => md.render(value ? (value[selectedLanguageCode] ?? "") : "")}
        key={`${questionIdx}-${selectedLanguageCode}`}
        setFirstRender={setFirstRender}
        setText={(v: string) => {
          if (localSurvey.questions[questionIdx]) {
            const translatedHtml = {
              ...value,
              [selectedLanguageCode]: v,
            };
            if (questionIdx === -1) {
              // welcome card
              updateQuestion({ html: translatedHtml });
              return;
            }
            updateQuestion(questionIdx, { html: translatedHtml });
          }
        }}
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
              <label
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
