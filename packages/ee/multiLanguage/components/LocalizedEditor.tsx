import DOMPurify from "dompurify";
import type { Dispatch, SetStateAction } from "react";

import {
  containsTranslations,
  extractLanguageIds,
  isLabelValidForAllLanguages,
} from "@formbricks/lib/i18n/utils";
import { md } from "@formbricks/lib/markdownIt";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TLanguage } from "@formbricks/types/product";
import { TI18nString, TSurvey } from "@formbricks/types/surveys";
import { Editor } from "@formbricks/ui/Editor";

import { LanguageIndicator } from "./LanguageIndicator";

interface LocalizedEditorProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  isInvalid: boolean;
  updateQuestion: any;
  selectedLanguageId: string;
  setSelectedLanguageId: (languageId: string) => void;
  questionIdx: number;
  surveyLanguages: TLanguage[];
  firstRender: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  defaultLanguageId: string;
}
export const LocalizedEditor = ({
  id,
  value,
  localSurvey,
  isInvalid,
  updateQuestion,
  selectedLanguageId,
  setSelectedLanguageId,
  questionIdx,
  surveyLanguages,
  firstRender,
  setFirstRender,
  defaultLanguageId,
}: LocalizedEditorProps) => {
  const hasi18n = value ? containsTranslations(value) : false;
  const surveyLanguageIds = extractLanguageIds(surveyLanguages);
  const isInComplete =
    value !== undefined &&
    (id === "subheader"
      ? value[defaultLanguageId]?.trim() !== "" &&
        isInvalid &&
        !isLabelValidForAllLanguages(value, surveyLanguageIds) &&
        selectedLanguageId === defaultLanguageId
      : isInvalid &&
        !isLabelValidForAllLanguages(value, surveyLanguageIds) &&
        selectedLanguageId === defaultLanguageId);

  return (
    <div className="relative w-full">
      <Editor
        key={`${questionIdx}-${selectedLanguageId}`}
        getText={() => md.render(value ? value[selectedLanguageId] ?? "" : "")}
        setText={(v: string) => {
          if (!value) return;
          let translatedHtml = {
            ...value,
            [selectedLanguageId]: v,
          };
          if (questionIdx === -1) {
            // welcome card
            updateQuestion({ html: translatedHtml });
            return;
          }
          updateQuestion(questionIdx, { html: translatedHtml });
        }}
        excludedToolbarItems={["blockType"]}
        disableLists
        firstRender={firstRender}
        setFirstRender={setFirstRender}
      />
      {hasi18n && surveyLanguages.length > 1 && (
        <div>
          <LanguageIndicator
            selectedLanguageId={selectedLanguageId}
            surveyLanguages={surveyLanguages}
            setSelectedLanguageId={setSelectedLanguageId}
          />

          {value && selectedLanguageId !== defaultLanguageId && value[defaultLanguageId] && (
            <div className="mt-1 flex text-xs text-gray-500">
              <strong>Translate:</strong>
              <label
                className="fb-htmlbody ml-1" // styles are in global.css
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    recallToHeadline(value, localSurvey, false, defaultLanguageId)[defaultLanguageId] ?? ""
                  ),
                }}></label>
            </div>
          )}
        </div>
      )}

      {isInComplete && <div className="mt-1 text-xs text-red-400">Contains Incomplete translations</div>}
    </div>
  );
};
