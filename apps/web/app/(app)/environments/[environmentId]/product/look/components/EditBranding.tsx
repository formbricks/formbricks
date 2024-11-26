"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";
import { updateProductAction } from "../../actions";

interface EditFormbricksBrandingProps {
  type: "linkSurvey" | "inAppSurvey";
  product: TProduct;
  canRemoveBranding: boolean;
  environmentId: string;
}

export const EditFormbricksBranding = ({
  type,
  product,
  canRemoveBranding,
  environmentId,
}: EditFormbricksBrandingProps) => {
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(
    type === "linkSurvey" ? product.linkSurveyBranding : product.inAppSurveyBranding
  );
  const [updatingBranding, setUpdatingBranding] = useState(false);

  const toggleBranding = async () => {
    try {
      setUpdatingBranding(true);
      const newBrandingState = !isBrandingEnabled;
      setIsBrandingEnabled(newBrandingState);
      let inputProduct: Partial<TProductUpdateInput> = {
        [type === "linkSurvey" ? "linkSurveyBranding" : "inAppSurveyBranding"]: newBrandingState,
      };
      await updateProductAction({ productId: product.id, data: inputProduct });
      toast.success(newBrandingState ? "Formbricks branding is shown." : "Formbricks branding is hidden.");
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setUpdatingBranding(false);
    }
  };

  return (
    <div className="w-full items-center space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id={`branding-${type}`}
          checked={isBrandingEnabled}
          onCheckedChange={toggleBranding}
          disabled={!canRemoveBranding || updatingBranding}
        />
        <Label htmlFor={`branding-${type}`}>
          Show Formbricks Branding in {type === "linkSurvey" ? "Link" : "In-App"} Surveys
        </Label>
      </div>
      {!canRemoveBranding && (
        <div>
          {type === "linkSurvey" && (
            <div className="mb-8">
              <UpgradePlanNotice
                message="To remove the Formbricks branding from Link Surveys, please"
                textForUrl="upgrade your plan."
                url={`/environments/${environmentId}/settings/billing`}
              />
            </div>
          )}
          {type !== "linkSurvey" && (
            <UpgradePlanNotice
              message="To remove the Formbricks branding from In-app Surveys, please"
              textForUrl="upgrade your plan."
              url={`/environments/${environmentId}/settings/billing`}
            />
          )}
        </div>
      )}
    </div>
  );
};
