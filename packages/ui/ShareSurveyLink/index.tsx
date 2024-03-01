import { Copy, Languages, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import useClickOutside from "@formbricks/lib/useClickOutside";
import { TSurvey } from "@formbricks/types/surveys";

import { getLanguageLabel } from "../../ee/multiLanguage/lib/isoLanguages";
import { Button } from "../Button";
import { generateSingleUseIdAction } from "./actions";

interface ShareSurveyLinkProps {
  survey: TSurvey;
  webAppUrl: string;
  surveyUrl: string;
  setSurveyUrl: (url: string) => void;
}

interface LanguageDropdownProps {
  survey: TSurvey;
  setLanguage: (language: string) => void;
}

interface SurveyLinkDisplayProps {
  surveyUrl: string;
}

const LanguageDropdown = ({ survey, setLanguage }: LanguageDropdownProps) => {
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const languageDropdownRef = useRef(null);

  useClickOutside(languageDropdownRef, () => setShowLanguageSelect(false));

  return (
    survey.languages.length > 1 && (
      <div className="relative">
        {showLanguageSelect && (
          <div
            className="absolute top-12 z-30 w-fit rounded-lg border bg-slate-900 p-1 text-sm text-white"
            ref={languageDropdownRef}>
            {survey.languages.map((surveyLanguage) => (
              <div
                key={surveyLanguage.language.code}
                className="rounded-md px-1 py-2 hover:cursor-pointer hover:bg-slate-700"
                onClick={() => {
                  setLanguage(surveyLanguage.language.code);
                  setShowLanguageSelect(false);
                }}>
                {getLanguageLabel(surveyLanguage.language.code)}
              </div>
            ))}
          </div>
        )}
        <Button
          variant="secondary"
          title="Select Language"
          aria-label="Select Language"
          onClick={() => setShowLanguageSelect(!showLanguageSelect)}>
          <Languages className="h-5 w-5" />
        </Button>
      </div>
    )
  );
};

export const SurveyLinkDisplay = ({ surveyUrl }: SurveyLinkDisplayProps) => {
  const linkTextRef = useRef(null);

  const handleTextSelection = () => {
    if (linkTextRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkTextRef.current);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  return (
    <div
      className="mt-2 max-w-[80%] overflow-hidden rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-800"
      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      onClick={handleTextSelection}>
      {surveyUrl}
    </div>
  );
};

export const ShareSurveyLink = ({ survey, webAppUrl, surveyUrl, setSurveyUrl }: ShareSurveyLinkProps) => {
  const [language, setLanguage] = useState("default");

  const getUrl = useCallback(async () => {
    let url = `${webAppUrl}/s/${survey.id}`;
    const queryParams: string[] = [];

    if (survey.singleUse?.enabled) {
      const singleUseId = await generateSingleUseIdAction(survey.id, survey.singleUse.isEncrypted);
      queryParams.push(`suId=${singleUseId}`);
    }

    if (language !== "default") {
      queryParams.push(`lang=${language}`);
    }

    if (queryParams.length) {
      url += `?${queryParams.join("&")}`;
    }

    setSurveyUrl(url);
  }, [survey, webAppUrl, language]);

  const generateNewSingleUseLink = () => {
    getUrl();
    toast.success("New single use link generated");
  };

  useEffect(() => {
    getUrl();
  }, [survey, getUrl, language]);

  return (
    <div
      className={`flex max-w-full flex-col items-center justify-center space-x-2 ${survey.singleUse?.enabled ? "flex-col" : "lg:flex-row"}`}>
      <SurveyLinkDisplay surveyUrl={surveyUrl} />
      <div className="mt-2 flex items-center justify-center space-x-2">
        <LanguageDropdown survey={survey} setLanguage={setLanguage} />
        <Button
          variant="darkCTA"
          title="Copy survey link to clipboard"
          aria-label="Copy survey link to clipboard"
          onClick={() => {
            navigator.clipboard.writeText(surveyUrl);
            toast.success("URL copied to clipboard!");
          }}
          EndIcon={Copy}>
          Copy Link
        </Button>
        {survey.singleUse?.enabled && (
          <Button
            variant="darkCTA"
            title="Regenerate single use survey link"
            aria-label="Regenerate single use survey link"
            onClick={generateNewSingleUseLink}>
            <RefreshCcw className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
};
