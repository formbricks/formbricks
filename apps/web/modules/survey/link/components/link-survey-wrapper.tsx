import { type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import { SurveyType, Workspace } from "@formbricks/database/prisma-browser";
import { getLinkSurveyCardMaxWidth } from "@formbricks/types/styling";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import { getFooterLinkStyle } from "@/lib/styling/footer-link-color";
import { LegalFooter } from "@/modules/survey/link/components/legal-footer";
import { SurveyLoadingAnimation } from "@/modules/survey/link/components/survey-loading-animation";
import { CardlessPreviewLogo } from "@/modules/ui/components/cardless-preview-logo";
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
}: Readonly<LinkSurveyWrapperProps>) => {
  const { t } = useTranslation();
  //for embedded survey strip away all surrounding css
  const [isBackgroundLoaded, setIsBackgroundLoaded] = useState(false);

  const handleBackgroundLoaded = (isLoaded: boolean) => {
    if (isLoaded) {
      setIsBackgroundLoaded(true);
    }
  };
  const styling = determineStyling();
  // Footer legal links sit on the survey background; resolve an AA-compliant color (and an
  // optional backdrop for non-solid backgrounds). An explicit footerLinkColor override wins —
  // and also disables the near-white media backdrop: the user takes ownership of contrast, and
  // e.g. a light override would otherwise be unreadable on the light backdrop.
  const footerLinkStyle = getFooterLinkStyle(styling);
  const explicitFooterLinkColor = styling.footerLinkColor?.light;
  const footerLinkColor = explicitFooterLinkColor ?? footerLinkStyle.textColor;
  const footerLinkBackdropColor = explicitFooterLinkColor ? undefined : footerLinkStyle.backdropColor;
  const isCardless = styling.cardArrangement?.linkSurveys === "cardless";
  const linkSurveyCardMaxWidth = getLinkSurveyCardMaxWidth(styling.linkSurveyCardWidth);
  const hasLogo = !styling.isLogoHidden && !!(workspace.logo?.url || styling.logo?.url);
  const showCardlessLogo = isCardless && hasLogo;
  // Cardless surveys span the full available width; card-based surveys are capped to the configured width.
  const cardMaxWidthStyle = isCardless ? undefined : { maxWidth: linkSurveyCardMaxWidth };

  const renderEmbeddedLayout = () => (
    <div className={cn("h-full w-full overflow-auto", !isCardless && "overflow-clip")}>
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={isWelcomeCardEnabled}
        isBrandingEnabled={isBrandingEnabled}
      />
      <main
        className={cn(
          "flex h-full w-full flex-col",
          isCardless && "overflow-hidden",
          !isCardless && "mx-auto",
          styling.cardArrangement?.linkSurveys === "straight" && "pt-6",
          styling.cardArrangement?.linkSurveys === "casual" && "px-6 py-10"
        )}
        style={cardMaxWidthStyle}>
        {children}
      </main>
    </div>
  );

  const renderStandardLayout = () => (
    <div>
      <SurveyLoadingAnimation
        isWelcomeCardEnabled={isWelcomeCardEnabled}
        isBackgroundLoaded={isBackgroundLoaded}
        isBrandingEnabled={isBrandingEnabled}
      />
      <MediaBackground
        surveyType={surveyType}
        styling={styling}
        onBackgroundLoaded={handleBackgroundLoaded}
        useNaturalHeight={isCardless}>
        <div
          className={cn(
            "flex w-full justify-center",
            isCardless
              ? "h-full min-h-0 flex-1 flex-col items-stretch overflow-hidden"
              : "max-h-dvh min-h-dvh items-center overflow-clip"
          )}>
          {!showCardlessLogo && hasLogo && (
            <header>
              <ClientLogo
                workspaceLogo={workspace.logo}
                workspaceId={workspaceId}
                surveyLogo={styling.logo}
                dir={dir}
              />
            </header>
          )}
          <div
            className={cn(
              "w-full",
              isCardless ? "flex min-h-0 w-full flex-1 flex-col" : "mx-auto h-full space-y-6 px-1.5"
            )}
            style={cardMaxWidthStyle}>
            {isPreview && (
              <div className="fixed top-0 left-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-xs">
                <div />
                {t("workspace.surveys.edit.survey_preview")}
                <ResetProgressButton onClick={handleResetSurvey} />
              </div>
            )}
            <main
              className={cn(
                "flex min-h-0 w-full flex-1 flex-col",
                isPreview && isCardless && "pt-8",
                !isCardless && "justify-center"
              )}>
              {children}
            </main>
            {isCardless && (
              <LegalFooter
                IMPRINT_URL={IMPRINT_URL}
                PRIVACY_URL={PRIVACY_URL}
                TERMS_URL={TERMS_URL}
                IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
                surveyUrl={publicDomain + "/s/" + surveyId}
                linkColor={footerLinkColor}
                backdropColor={footerLinkBackdropColor}
                isInFlow
              />
            )}
          </div>
        </div>
      </MediaBackground>
      {showCardlessLogo && (
        <CardlessPreviewLogo
          workspaceLogo={workspace.logo}
          workspaceId={workspaceId}
          surveyLogo={styling.logo}
          previewSurvey={false}
        />
      )}
      {!isCardless && (
        <LegalFooter
          IMPRINT_URL={IMPRINT_URL}
          PRIVACY_URL={PRIVACY_URL}
          TERMS_URL={TERMS_URL}
          IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
          surveyUrl={publicDomain + "/s/" + surveyId}
          linkColor={footerLinkColor}
          backdropColor={footerLinkBackdropColor}
        />
      )}
    </div>
  );

  return isEmbed ? renderEmbeddedLayout() : renderStandardLayout();
};
