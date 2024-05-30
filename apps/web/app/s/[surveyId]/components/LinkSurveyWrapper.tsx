import React from "react";

import { TProduct, TProductStyling } from "@formbricks/types/product";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys";
import { ClientLogo } from "@formbricks/ui/ClientLogo";
import { ResetProgressButton } from "@formbricks/ui/ResetProgressButton";

interface LinkSurveyWrapperProps {
  children: JSX.Element;
  product: TProduct;
  survey: TSurvey;
  isPreview: boolean;
  isEmbed: boolean;
  determineStyling: () => TSurveyStyling | TProductStyling;
  setQuestionId: (_: string) => void;
}

export const LinkSurveyWrapper = ({
  children,
  product,
  survey,
  isPreview,
  isEmbed,
  determineStyling,
  setQuestionId,
}: LinkSurveyWrapperProps) => {
  //for embedded survey strip away all surrounding css
  if (isEmbed) return <div className="m-auto max-w-md">{children}</div>;
  else
    return (
      <div className="flex max-h-dvh min-h-dvh items-end justify-center overflow-clip md:items-center">
        {!determineStyling().isLogoHidden && product.logo?.url && <ClientLogo product={product} />}
        <div className="w-full space-y-6 p-0 md:max-w-md ">
          {isPreview && (
            <div className="fixed left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
              <div />
              Survey Preview 👀
              <ResetProgressButton
                onClick={() => setQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id)}
              />
            </div>
          )}
          {children}
        </div>
      </div>
    );
};
