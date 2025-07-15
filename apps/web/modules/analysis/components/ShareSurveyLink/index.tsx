"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { Copy, SquareArrowOutUpRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getSurveyUrl } from "../../utils";
import { LanguageDropdown } from "./components/LanguageDropdown";
import { SurveyLinkDisplay } from "./components/SurveyLinkDisplay";

interface ShareSurveyLinkProps {
  survey: TSurvey;
  publicDomain: string;
  surveyUrl: string;
  setSurveyUrl: (url: string) => void;
  locale: TUserLocale;
}

export const ShareSurveyLink = ({
  survey,
  surveyUrl,
  publicDomain,
  setSurveyUrl,
  locale,
}: ShareSurveyLinkProps) => {
  const { t } = useTranslate();

  const handleLanguageChange = (language: string) => {
    const url = getSurveyUrl(survey, publicDomain, language);
    setSurveyUrl(url);
  };

  return (
    <div className={"flex max-w-full flex-col items-center justify-center gap-2 md:flex-row"}>
      <SurveyLinkDisplay surveyUrl={surveyUrl} key={surveyUrl} />
      <div className="flex items-center justify-center space-x-2">
        <LanguageDropdown survey={survey} setLanguage={handleLanguageChange} locale={locale} />
        <Button
          disabled={!surveyUrl}
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
        <Button
          title={t("environments.surveys.preview_survey_in_a_new_tab")}
          aria-label={t("environments.surveys.preview_survey_in_a_new_tab")}
          disabled={!surveyUrl}
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
      </div>
    </div>
  );
};
