import { Copy, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "../Button";
import { generateSingleUseIdAction } from "./actions";
import { LanguageDropdown } from "./components/LanguageDropdown";
import { SurveyLinkDisplay } from "./components/SurveyLinkDisplay";

interface ShareSurveyLinkProps {
  survey: TSurvey;
  webAppUrl: string;
  surveyUrl: string;
  setSurveyUrl: (url: string) => void;
}

export const ShareSurveyLink = ({ survey, webAppUrl, surveyUrl, setSurveyUrl }: ShareSurveyLinkProps) => {
  const [language, setLanguage] = useState("default");

  const getUrl = useCallback(async () => {
    let url = `${webAppUrl}/s/${survey.id}`;
    const queryParams: string[] = [];

    if (survey.singleUse?.enabled) {
      const singleUseIdResponse = await generateSingleUseIdAction({
        surveyId: survey.id,
        isEncrypted: survey.singleUse.isEncrypted,
      });

      if (singleUseIdResponse?.data) {
        queryParams.push(`suId=${singleUseIdResponse.data}`);
      } else {
        const errorMessage = getFormattedErrorMessage(singleUseIdResponse);
        toast.error(errorMessage);
      }
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
