import DOMPurify from "dompurify";
import type { Dispatch, SetStateAction } from "react";
import React, { useMemo } from "react";
import { extractLanguageCodes, isLabelValidForAllLanguages } from "@formbricks/lib/i18n/utils";
import { md } from "@formbricks/lib/markdownIt";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import type {
  TI18nString,
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyRedirectUrlCard,
} from "@formbricks/types/surveys/types";
import { Editor } from "@formbricks/ui/components/Editor";
import { LanguageIndicator } from "./language-indicator";

interface LocalizedEditorProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  isInvalid: boolean;
  updateQuestion?: any;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  questionIdx: number;
  firstRender: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  showRecallItemSelect?: boolean;
  stripHtmlTags?: (html: string) => string;
  updateSurvey?: (data: Partial<TSurveyEndScreenCard> | Partial<TSurveyRedirectUrlCard>) => void;
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
  showRecallItemSelect,
  stripHtmlTags,
  updateSurvey,
}: LocalizedEditorProps) {
  const isEndingCard = questionIdx >= localSurvey.questions.length;
  const isWelcomeCard = questionIdx === -1;
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
        showRecallItemSelect={showRecallItemSelect}
        setText={(v: string) => {
          if (!value) return;
          const translatedHtml = {
            ...value,
            [selectedLanguageCode]: v,
          };
          if (isWelcomeCard || isEndingCard) {
            if (updateSurvey) {
              updateSurvey({ [id]: translatedHtml });
            }
            return;
          }
          updateQuestion(questionIdx, { [id]: translatedHtml });
        }}
      />
      {localSurvey.languages.length > 1 && (
        <div>
          <LanguageIndicator
            selectedLanguageCode={selectedLanguageCode}
            setFirstRender={setFirstRender}
            setSelectedLanguageCode={setSelectedLanguageCode}
            surveyLanguages={localSurvey.languages}
          />

          {value && selectedLanguageCode !== "default" && value.default ? (
            <div className="mt-1 flex text-xs text-gray-500">
              <strong>Translate:</strong>
              <label
                className="fb-htmlbody ml-1" // styles are in global.css
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    recallToHeadline(value, localSurvey, false, "default", []).default ?? ""
                  ),
                }}
              />
            </div>
          ) : null}
        </div>
      )}

      {isInComplete ? <div className="mt-1 text-xs text-red-400">Incomplete translations</div> : null}
    </div>
  );
}
