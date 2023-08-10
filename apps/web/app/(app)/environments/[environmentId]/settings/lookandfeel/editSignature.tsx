"use client";

import { updateLookAndFeelOfProduct } from "@formbricks/lib/services/product";
import { TProduct, TProductLookAndFeelInput } from "@formbricks/types/v1/product";
import { Label, Switch } from "@formbricks/ui";
import { useState } from "react";
import toast from "react-hot-toast";

export function EditFormbricksSignature({ product }: { product: TProduct }) {
  const [formbricksSignature, setFormbricksSignature] = useState(product.formbricksSignature);
  const [updatingSignature, setUpdatingSignature] = useState(false);

  const toggleSignature = async () => {
    try {
      setUpdatingSignature(true);
      const newSignatureState = !formbricksSignature;
      setFormbricksSignature(newSignatureState);
      const updatedProduct: TProductLookAndFeelInput = {
        ...product,
        formbricksSignature: newSignatureState,
      };
      await updateLookAndFeelOfProduct(updatedProduct, product.id);
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
          disabled={updatingSignature}
        />
        <Label htmlFor="signature">Show &apos;Powered by Formbricks&apos; Signature</Label>
      </div>
    </div>
  );
}
