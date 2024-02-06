import DOMPurify from "dompurify";
import type { Dispatch, SetStateAction } from "react";

import { extractLanguageSymbols, isLabelValidForAllLanguages } from "@formbricks/lib/i18n/utils";
import { md } from "@formbricks/lib/markdownIt";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TLanguages } from "@formbricks/types/product";
import { TI18nString, TSurvey } from "@formbricks/types/surveys";
import { Editor } from "@formbricks/ui/Editor";

import { LanguageIndicator } from "./LanguageIndicator";

interface LocalizedEditorProps {
  id: string;
  value: TI18nString | undefined;
  localSurvey: TSurvey;
  isInvalid: boolean;
  updateQuestion: any;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  questionIdx: number;
  surveyLanguages: TLanguages;
  firstRender: boolean;
  setFirstRender?: Dispatch<SetStateAction<boolean>>;
  defaultLanguageSymbol: string;
}
export const LocalizedEditor = ({
  id,
  value,
  localSurvey,
  isInvalid,
  updateQuestion,
  selectedLanguage,
  setSelectedLanguage,
  questionIdx,
  surveyLanguages,
  firstRender,
  setFirstRender,
  defaultLanguageSymbol,
}: LocalizedEditorProps) => {
  const hasi18n = value ? value._i18n_ : false;
  const surveyLanguageList = Object.entries(surveyLanguages);

  const isInComplete =
    value !== undefined &&
    (id === "subheader"
      ? value[defaultLanguageSymbol]?.trim() !== "" &&
        isInvalid &&
        !isLabelValidForAllLanguages(value, extractLanguageSymbols(surveyLanguageList)) &&
        selectedLanguage === defaultLanguageSymbol
      : isInvalid &&
        !isLabelValidForAllLanguages(value, extractLanguageSymbols(surveyLanguageList)) &&
        selectedLanguage === defaultLanguageSymbol);

  return (
    <div className="relative w-full">
      <Editor
        key={`${questionIdx}-${selectedLanguage}`}
        getText={() => md.render(value ? value[selectedLanguage] : "")}
        setText={(v: string) => {
          if (!value) return;
          let translatedHtml = {
            ...(value as TI18nString),
            [selectedLanguage]: v,
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
      {hasi18n && surveyLanguageList?.length > 1 && (
        <div>
          <LanguageIndicator
            selectedLanguage={selectedLanguage}
            surveyLanguages={surveyLanguageList}
            setSelectedLanguage={setSelectedLanguage}
          />

          {value && selectedLanguage !== defaultLanguageSymbol && value[defaultLanguageSymbol] && (
            <div className="mt-1 flex text-xs text-gray-500">
              <strong>Translate:</strong>
              <label
                className="fb-htmlbody ml-1" // styles are in global.css
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    recallToHeadline(value, localSurvey, false, defaultLanguageSymbol)[
                      defaultLanguageSymbol
                    ] ?? ""
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
