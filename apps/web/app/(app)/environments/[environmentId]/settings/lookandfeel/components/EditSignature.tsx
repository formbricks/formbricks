"use client";

import { Alert, AlertDescription } from "@formbricks/ui/Alert";
import { updateProductAction } from "../actions";
import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

interface EditSignatureProps {
  product: TProduct;
  canRemoveSignature: boolean;
  environmentId: string;
}

export function EditFormbricksSignature({ product, canRemoveSignature, environmentId }: EditSignatureProps) {
  const [formbricksSignature, setFormbricksSignature] = useState(product.formbricksSignature);
  const [updatingSignature, setUpdatingSignature] = useState(false);

  const toggleSignature = async () => {
    try {
      setUpdatingSignature(true);
      const newSignatureState = !formbricksSignature;
      setFormbricksSignature(newSignatureState);
      let inputProduct: Partial<TProductUpdateInput> = {
        formbricksSignature: newSignatureState,
      };
      await updateProductAction(product.id, inputProduct);
      toast.success(
        newSignatureState ? "Formbricks signature will be shown." : "Formbricks signature will now be hidden."
      );
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setUpdatingSignature(false);
    }
  };

  return (
    <div className="w-full items-center">
      <div className="mb-4">
        <Alert>
          <AlertDescription>
            To remove the Formbricks branding from the link surveys, please{" "}
            <b>
              <Link href={`/environments/${environmentId}/settings/billing`}>upgrade</Link>
            </b>{" "}
            your plan.
          </AlertDescription>
        </Alert>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="signature"
          checked={formbricksSignature}
          onCheckedChange={toggleSignature}
          disabled={!canRemoveSignature || updatingSignature}
        />
        <Label htmlFor="signature">Show &apos;Powered by Formbricks&apos; Signature in Link Surveys</Label>
      </div>
    </div>
  );
}
