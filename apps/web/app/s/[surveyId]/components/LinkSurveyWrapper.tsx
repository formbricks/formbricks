import { LegalFooter } from "@/app/s/[surveyId]/components/LegalFooter";
import React from "react";

import { cn } from "@formbricks/lib/cn";
import { TProduct, TProductStyling } from "@formbricks/types/product";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys";
import { ClientLogo } from "@formbricks/ui/ClientLogo";
import { MediaBackground } from "@formbricks/ui/MediaBackground";
import { ResetProgressButton } from "@formbricks/ui/ResetProgressButton";

interface LinkSurveyWrapperProps {
  children: JSX.Element;
  product: TProduct;
  survey: TSurvey;
  isPreview: boolean;
  isEmbed: boolean;
  determineStyling: () => TSurveyStyling | TProductStyling;
  setQuestionId: (_: string) => void;
  IMPRINT_URL?: string;
  PRIVACY_URL?: string;
  IS_FORMBRICKS_CLOUD: boolean;
  webAppUrl: string;
}

export const LinkSurveyWrapper = ({
  children,
  product,
  survey,
  isPreview,
  isEmbed,
  determineStyling,
  setQuestionId,
  IMPRINT_URL,
  PRIVACY_URL,
  IS_FORMBRICKS_CLOUD,
  webAppUrl,
}: LinkSurveyWrapperProps) => {
  //for embedded survey strip away all surrounding css
  const styling = determineStyling();
  if (isEmbed)
    return (
      <div
        className={cn(
          "h-full w-full overflow-clip",
          styling.cardArrangement?.linkSurveys === "straight" && "pt-5",
          styling.cardArrangement?.linkSurveys === "casual" && "px-6 py-10"
        )}>
        {children}
      </div>
    );
  else
    return (
      <div>
        <MediaBackground survey={survey} product={product}>
          <div className="flex max-h-dvh min-h-dvh items-end justify-center overflow-clip md:items-center">
            {!styling.isLogoHidden && product.logo?.url && <ClientLogo product={product} />}
            <div className="h-full w-full space-y-6 p-0 md:max-w-md">
              {isPreview && (
                <div className="fixed left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
                  <div />
                  Survey Preview 👀
                  <ResetProgressButton
                    onClick={() =>
                      setQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id)
                    }
                  />
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
