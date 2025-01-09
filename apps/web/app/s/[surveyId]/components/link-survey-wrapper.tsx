import { LegalFooter } from "@/app/s/[surveyId]/components/legal-footer";
import { SurveyLoadingAnimation } from "@/app/s/[surveyId]/components/survey-loading-animation";
import { ClientLogo } from "@/modules/ui/components/client-logo";
import { MediaBackground } from "@/modules/ui/components/media-background";
import { ResetProgressButton } from "@/modules/ui/components/reset-progress-button";
import { type JSX, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TProject, TProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";

interface LinkSurveyWrapperProps {
  children: JSX.Element;
  project: TProject;
  survey: TSurvey;
  isPreview: boolean;
  isEmbed: boolean;
  determineStyling: () => TSurveyStyling | TProjectStyling;
  handleResetSurvey: () => void;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  webAppUrl: string;
  isBrandingEnabled: boolean;
}

export const LinkSurveyWrapper = ({
  children,
  project,
  survey,
  isPreview,
  isEmbed,
  determineStyling,
  handleResetSurvey,
  IMPRINT_URL,
  PRIVACY_URL,
  IS_FORMBRICKS_CLOUD,
  webAppUrl,
  isBrandingEnabled,
}: LinkSurveyWrapperProps) => {
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
        <SurveyLoadingAnimation survey={survey} isBrandingEnabled={isBrandingEnabled} />
        {children}
      </div>
    );
  else
    return (
      <div>
        <SurveyLoadingAnimation
          survey={survey}
          isBackgroundLoaded={isBackgroundLoaded}
          isBrandingEnabled={isBrandingEnabled}
        />
        <MediaBackground survey={survey} project={project} onBackgroundLoaded={handleBackgroundLoaded}>
          <div className="flex max-h-dvh min-h-dvh items-end justify-center overflow-clip sm:items-center">
            {!styling.isLogoHidden && project.logo?.url && <ClientLogo project={project} />}
            <div className="h-full w-full space-y-6 p-0 sm:max-w-lg">
              {isPreview && (
                <div className="fixed left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
                  <div />
                  Survey Preview 👀
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
          IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
          surveyUrl={webAppUrl + "/s/" + survey.id}
        />
      </div>
    );
};
