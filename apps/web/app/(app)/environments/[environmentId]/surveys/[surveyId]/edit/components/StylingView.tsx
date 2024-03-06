import CardStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/CardStylingSettings";
import FormStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/FormStylingSettings";
import React from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

type StylingViewProps = {
  environment: TEnvironment;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colours: string[];
  product: TProduct;
};

const StylingView = ({ colours, environment, localSurvey, setLocalSurvey, product }: StylingViewProps) => {
  return (
    <div className="mt-12 space-y-3 p-5">
      <FormStylingSettings localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />

      <CardStylingSettings localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
    </div>
  );
};

export default StylingView;
