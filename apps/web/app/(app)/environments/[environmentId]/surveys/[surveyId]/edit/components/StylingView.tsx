import CardStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/CardStylingSettings";
import FormStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/FormStylingSettings";
import StylingCard from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/StylingCard";
import React, { useMemo } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { Switch } from "@formbricks/ui/Switch";

type StylingViewProps = {
  environment: TEnvironment;
  product: TProduct;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colours: string[];
};

const StylingView = ({ colours, environment, product, localSurvey, setLocalSurvey }: StylingViewProps) => {
  const overwriteUnifiedStyling = useMemo(() => {
    // unified styling is disabled from the product.
    // we don't need to show the switch
    if (!product.styling?.unifiedStyling) return true;

    return !!localSurvey?.styling?.overwriteUnifiedStyling;
  }, [localSurvey?.styling?.overwriteUnifiedStyling, product.styling?.unifiedStyling]);

  const setOverwriteUnifiedStyling = (value: boolean) => {
    setLocalSurvey((prev) => ({ ...prev, styling: { ...prev.styling, overwriteUnifiedStyling: value } }));
  };

  return (
    <div className="mt-12 space-y-3 p-5">
      {!!product?.styling?.unifiedStyling && (
        <div className="flex items-center gap-4 py-4">
          <Switch checked={overwriteUnifiedStyling} onCheckedChange={setOverwriteUnifiedStyling} />
          <div className="flex flex-col">
            <h3 className="text-base font-semibold text-slate-900">Overwrite Unified Styling</h3>
            <p className="text-sm text-slate-800">
              Ignore the unified style settings and style this survey individually
            </p>
          </div>
        </div>
      )}

      <FormStylingSettings
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        disabled={!overwriteUnifiedStyling}
      />

      <CardStylingSettings
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        disabled={!overwriteUnifiedStyling}
      />

      <StylingCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        colours={colours}
        environmentId={environment.id}
        disabled={!overwriteUnifiedStyling}
      />
    </div>
  );
};

export default StylingView;
