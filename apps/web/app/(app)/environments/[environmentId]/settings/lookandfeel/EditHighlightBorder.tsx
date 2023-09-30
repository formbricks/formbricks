"use client";

import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/v1/product";
import { Button, ColorPicker, Label, Switch } from "@formbricks/ui";
import { useState } from "react";
import toast from "react-hot-toast";
import { updateProductAction } from "./actions";

interface EditHighlightBorderProps {
  product: TProduct;
  defaultBrandColor: string;
}

export const EditHighlightBorder = ({ product, defaultBrandColor }: EditHighlightBorderProps) => {
  const [showHighlightBorder, setShowHighlightBorder] = useState(product.highlightBorderColor ? true : false);
  const [color, setColor] = useState<string | null>(product.highlightBorderColor || defaultBrandColor);
  const [updatingBorder, setUpdatingBorder] = useState(false);

  const handleUpdateHighlightBorder = async () => {
    try {
      setUpdatingBorder(true);
      await updateProductAction(product.id, { highlightBorderColor: color });
      toast.success("Border color updated successfully.");
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setUpdatingBorder(false);
    }
  };

  const handleSwitch = (checked: boolean) => {
    if (checked) {
      if (!color) {
        setColor(defaultBrandColor);
        setShowHighlightBorder(true);
      } else {
        setShowHighlightBorder(true);
      }
    } else {
      setShowHighlightBorder(false);
      setColor(null);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-col md:flex-row">
      <div className="flex w-full flex-col px-6 py-5 md:w-1/2">
        <div className="mb-6 flex items-center space-x-2">
          <Switch id="highlightBorder" checked={showHighlightBorder} onCheckedChange={handleSwitch} />
          <h2 className="text-sm font-medium text-slate-800">Show highlight border</h2>
        </div>

        {showHighlightBorder && color ? (
          <>
            <Label htmlFor="brandcolor">Color (HEX)</Label>
            <ColorPicker color={color} onChange={setColor} />
          </>
        ) : null}

        <Button
          variant="darkCTA"
          className="mt-4 flex max-w-[80px] items-center justify-center"
          loading={updatingBorder}
          onClick={handleUpdateHighlightBorder}>
          Save
        </Button>
      </div>

      <div className="mt-4 flex w-full flex-col items-center justify-center gap-4 bg-slate-200 px-6 py-5 md:mt-0 md:w-1/2">
        <h3 className="text-slate-500">Preview</h3>
        <div
          className={cn("flex flex-col gap-4 rounded-lg border-2 bg-white p-5")}
          {...(showHighlightBorder &&
            color && {
              style: {
                borderColor: color,
              },
            })}>
          <h3 className="text-sm font-semibold text-slate-800">How easy was it for you to do this?</h3>
          <div className="grid grid-cols-5 rounded-xl border border-slate-400">
            {[1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                className="flex justify-center border-r border-slate-400 px-3 py-2 last:border-r-0 lg:px-6 lg:py-5">
                <span className="text-sm font-medium">{num}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
