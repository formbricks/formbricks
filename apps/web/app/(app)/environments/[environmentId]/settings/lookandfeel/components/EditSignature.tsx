"use client";

import { updateProductAction } from "../actions";
import { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { useState } from "react";
import toast from "react-hot-toast";

interface EditSignatureProps {
  product: TProduct;
  canRemoveSignature: boolean;
}

export function EditFormbricksSignature({ product, canRemoveSignature }: EditSignatureProps) {
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
      <div className="flex items-center space-x-2">
        <Switch
          id="signature"
          checked={formbricksSignature}
          onCheckedChange={toggleSignature}
          disabled={!canRemoveSignature || updatingSignature} // Modified this line
        />
        <Label htmlFor="signature">Show &apos;Powered by Formbricks&apos; Signature</Label>
      </div>
    </div>
  );
}
