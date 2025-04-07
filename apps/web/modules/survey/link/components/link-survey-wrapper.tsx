import { LegalFooter } from "@/modules/survey/link/components/legal-footer";
import { SurveyLoadingAnimation } from "@/modules/survey/link/components/survey-loading-animation";
import { ClientLogo } from "@/modules/ui/components/client-logo";
import { MediaBackground } from "@/modules/ui/components/media-background";
import { ResetProgressButton } from "@/modules/ui/components/reset-progress-button";
import { Project, SurveyType } from "@prisma/client";
import { type JSX, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling } from "@formbricks/types/surveys/types";

interface LinkSurveyWrapperProps {
  children: JSX.Element;
  project: Pick<Project, "styling" | "logo" | "linkSurveyBranding">;
  isWelcomeCardEnabled: boolean;
  surveyId: string;
  surveyType: SurveyType;
  isPreview: boolean;
  isEmbed: boolean;
  determineStyling: () => TSurveyStyling | TProjectStyling;
  handleResetSurvey: () => void;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  surveyDomain: string;
  isBrandingEnabled: boolean;
}

export const LinkSurveyWrapper = ({
  children,
  project,
  isWelcomeCardEnabled,
  surveyType,
  surveyId,
  isPreview,
  isEmbed,
  determineStyling,
  handleResetSurvey,
  IMPRINT_URL,
  PRIVACY_URL,
  IS_FORMBRICKS_CLOUD,
  surveyDomain,
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
            {!styling.isLogoHidden && project.logo?.url && <ClientLogo projectLogo={project.logo} />}
            <div className="h-full w-full max-w-4xl space-y-6 px-1.5">
              {isPreview && (
                <div className="fixed top-0 left-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-xs">
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
          surveyUrl={surveyDomain + "/s/" + surveyId}
        />
      </div>
    );
};
