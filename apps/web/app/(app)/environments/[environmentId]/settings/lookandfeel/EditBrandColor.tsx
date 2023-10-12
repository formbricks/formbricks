"use client";

import { TProduct, TProductUpdateInput } from "@formbricks/types/v1/product";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import { useState } from "react";
import toast from "react-hot-toast";
import { updateProductAction } from "./actions";

interface EditBrandColorProps {
  product: TProduct;
}

export function EditBrandColor({ product }: EditBrandColorProps) {
  const [color, setColor] = useState(product.brandColor);
  const [updatingColor, setUpdatingColor] = useState(false);

  const handleUpdateBrandColor = async () => {
    try {
      setUpdatingColor(true);
      let inputProduct: Partial<TProductUpdateInput> = {
        brandColor: color,
      };
      await updateProductAction(product.id, inputProduct);
      toast.success("Brand color updated successfully.");
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setUpdatingColor(false);
    }
  };

  return (
    <div className="w-full max-w-sm items-center">
      <Label htmlFor="brandcolor">Color (HEX)</Label>
      <ColorPicker color={color} onChange={setColor} />
      <Button variant="darkCTA" className="mt-4" loading={updatingColor} onClick={handleUpdateBrandColor}>
        Save
      </Button>
    </div>
  );
}
