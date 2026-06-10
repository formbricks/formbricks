import { type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import { SurveyType, Workspace } from "@formbricks/database/prisma-browser";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import { LegalFooter } from "@/modules/survey/link/components/legal-footer";
import { SurveyLoadingAnimation } from "@/modules/survey/link/components/survey-loading-animation";
import { ClientLogo } from "@/modules/ui/components/client-logo";
import { MediaBackground } from "@/modules/ui/components/media-background";
import { ResetProgressButton } from "@/modules/ui/components/reset-progress-button";

interface LinkSurveyWrapperProps {
  children: JSX.Element;
  workspace: Pick<Workspace, "styling" | "logo" | "linkSurveyBranding">;
  workspaceId: string;
  isWelcomeCardEnabled: boolean;
  surveyId: string;
  surveyType: SurveyType;
  isPreview: boolean;
  isEmbed: boolean;
  determineStyling: () => TSurveyStyling | TWorkspaceStyling;
  handleResetSurvey: () => void;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  TERMS_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  publicDomain: string;
  isBrandingEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export const LinkSurveyWrapper = ({
  children,
  workspace,
  workspaceId,
  isWelcomeCardEnabled,
  surveyType,
  surveyId,
  isPreview,
  isEmbed,
  determineStyling,
  handleResetSurvey,
  IMPRINT_URL,
  PRIVACY_URL,
  TERMS_URL,
  IS_FORMBRICKS_CLOUD,
  publicDomain,
  isBrandingEnabled,
  dir = "auto",
}: LinkSurveyWrapperProps) => {
  const { t } = useTranslation();
  //for embedded survey strip away all surrounding css
  const [isBackgroundLoaded, setIsBackgroundLoaded] = useState(false);

  const handleBackgroundLoaded = (isLoaded: boolean) => {
    if (isLoaded) {
      setIsBackgroundLoaded(true);
    }
  };
  const styling = determineStyling();
  if (isEmbed)
    return (
      <div
        className={cn(
          "h-full w-full overflow-clip",
          styling.cardArrangement?.linkSurveys === "straight" && "pt-6",
          styling.cardArrangement?.linkSurveys === "casual" && "px-6 py-10"
        )}>
        <SurveyLoadingAnimation
          isWelcomeCardEnabled={isWelcomeCardEnabled}
          isBrandingEnabled={isBrandingEnabled}
        />
        {children}
      </div>
    );
  else
    return (
      <div>
        <SurveyLoadingAnimation
          isWelcomeCardEnabled={isWelcomeCardEnabled}
          isBackgroundLoaded={isBackgroundLoaded}
          isBrandingEnabled={isBrandingEnabled}
        />
        <MediaBackground
          surveyType={surveyType}
          styling={styling}
          onBackgroundLoaded={handleBackgroundLoaded}>
          <div className="flex max-h-dvh min-h-dvh items-center justify-center overflow-clip">
            {!styling.isLogoHidden && (workspace.logo?.url || styling.logo?.url) && (
              <ClientLogo
                workspaceLogo={workspace.logo}
                workspaceId={workspaceId}
                surveyLogo={styling.logo}
                dir={dir}
              />
            )}
            <div className="h-full w-full max-w-4xl space-y-6 px-1.5">
              {isPreview && (
                <div className="fixed left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
                  <div />
                  {t("workspace.surveys.edit.survey_preview")}
                  <ResetProgressButton onClick={handleResetSurvey} />
                </div>
              )}
              {children}
            </div>
          </div>
        </MediaBackground>
        <LegalFooter
          IMPRINT_URL={IMPRINT_URL}
          PRIVACY_URL={PRIVACY_URL}
          TERMS_URL={TERMS_URL}
          IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
          surveyUrl={publicDomain + "/s/" + surveyId}
        />
      </div>
    );
};
