"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateSingleUseIdAction } from "@/modules/survey/list/actions";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { Copy, RefreshCcw, SquareArrowOutUpRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getSurveyDomain } from "@formbricks/lib/getSurveyUrl";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { LanguageDropdown } from "./components/LanguageDropdown";
import { SurveyLinkDisplay } from "./components/SurveyLinkDisplay";

interface ShareSurveyLinkProps {
  survey: TSurvey;
  surveyUrl: string;
  setSurveyUrl: (url: string) => void;
  locale: TUserLocale;
}

export const ShareSurveyLink = ({ survey, surveyUrl, setSurveyUrl, locale }: ShareSurveyLinkProps) => {
  const { t } = useTranslate();
  const [language, setLanguage] = useState("default");

  const getUrl = useCallback(async () => {
    let url = `${getSurveyDomain()}/s/${survey.id}`;
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
  }, [survey, language]);

  const generateNewSingleUseLink = () => {
    getUrl();
    toast.success(t("environments.surveys.new_single_use_link_generated"));
  };

  useEffect(() => {
    getUrl();
  }, [survey, getUrl, language]);

  return (
    <div
      className={`flex max-w-full flex-col items-center justify-center space-x-2 ${survey.singleUse?.enabled ? "flex-col" : "lg:flex-row"}`}>
      <SurveyLinkDisplay surveyUrl={surveyUrl} key={surveyUrl} />
      <div className="mt-2 flex items-center justify-center space-x-2">
        <LanguageDropdown survey={survey} setLanguage={setLanguage} locale={locale} />
        <Button
          title={t("environments.surveys.preview_survey_in_a_new_tab")}
          aria-label={t("environments.surveys.preview_survey_in_a_new_tab")}
          onClick={() => {
            let previewUrl = surveyUrl;
            if (previewUrl.includes("?")) {
              previewUrl += "&preview=true";
            } else {
              previewUrl += "?preview=true";
            }
            window.open(previewUrl, "_blank");
          }}>
          {t("common.preview")}
          <SquareArrowOutUpRight />
        </Button>
        <Button
          variant="secondary"
          title={t("environments.surveys.copy_survey_link_to_clipboard")}
          aria-label={t("environments.surveys.copy_survey_link_to_clipboard")}
          onClick={() => {
            navigator.clipboard.writeText(surveyUrl);
            toast.success(t("common.copied_to_clipboard"));
          }}>
          {t("common.copy")}
          <Copy />
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
