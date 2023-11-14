"use client";

import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { Alert, AlertDescription } from "@formbricks/ui/Alert";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { updateProductAction } from "../actions";

interface EditSignatureProps {
  type: "linkSurvey" | "inAppSurvey";
  product: TProduct;
  canRemoveSignature: boolean;
  environmentId: string;
}

export function EditFormbricksSignature({
  type,
  product,
  canRemoveSignature,
  environmentId,
}: EditSignatureProps) {
  const [isBrandingEnabled, setIsBrandingEnabled] = useState(
    type === "linkSurvey" ? product.linkSurveyBranding : product.inAppSurveyBranding
  );
  const [updatingSignature, setUpdatingSignature] = useState(false);

  const toggleSignature = async () => {
    try {
      setUpdatingSignature(true);
      const newSignatureState = !isBrandingEnabled;
      setIsBrandingEnabled(newSignatureState);
      let inputProduct: Partial<TProductUpdateInput> = {
        [type === "linkSurvey" ? "linkSurveyBranding" : "inAppSurveyBranding"]: newSignatureState,
      };
      await updateProductAction(product.id, inputProduct);
      toast.success(
        newSignatureState ? "Formbricks branding will be shown." : "Formbricks branding will now be hidden."
      );
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setUpdatingSignature(false);
    }
  };

  return (
    <div className="w-full items-center">
      {!canRemoveSignature && (
        <div className="mb-4">
          <Alert>
            <AlertDescription>
              To remove the Formbricks branding from the <span className="font-semibold">{type} surveys</span>
              , please{" "}
              {type === "linkSurvey" ? (
                <span className="underline">
                  <Link href={`/environments/${environmentId}/settings/billing`}>upgrade your plan.</Link>
                </span>
              ) : (
                <span className="underline">
                  <Link href={`/environments/${environmentId}/settings/billing`}>add your creditcard.</Link>
                </span>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
      <div className="mb-6 flex items-center space-x-2">
        <Switch
          id="branding"
          checked={isBrandingEnabled}
          onCheckedChange={toggleSignature}
          disabled={!canRemoveSignature || updatingSignature}
        />
        <Label htmlFor="signature">
          Show Formbricks Branding in {type === "linkSurvey" ? "Link" : "In-App"} Surveys
        </Label>
      </div>
    </div>
  );
}
