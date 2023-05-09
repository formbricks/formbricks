"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { useProductMutation } from "@/lib/products/mutateProducts";
import { useProduct } from "@/lib/products/products";
import {
  Button,
  ColorPicker,
  ErrorComponent,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
} from "@formbricks/ui";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export function EditBrandColor({ environmentId }) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  const { triggerProductMutate, isMutatingProduct } = useProductMutation(environmentId);

  const [color, setColor] = useState("");

  useEffect(() => {
    if (product) setColor(product.brandColor);
  }, [product]);

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <div>Error</div>;
  }

  return (
    <div className="w-full max-w-sm items-center">
      <Label htmlFor="brandcolor">Color (HEX)</Label>
      <ColorPicker color={color} onChange={setColor} />
      <Button
        type="submit"
        className="mt-4"
        loading={isMutatingProduct}
        onClick={() => {
          triggerProductMutate({ brandColor: color })
            .then(() => {
              toast.success("Brand color updated successfully.");
            })
            .catch((error) => {
              toast.error(`Error: ${error.message}`);
            });
        }}>
        Save
      </Button>
      {/*   <div className="whitespace-pre-wrap">{JSON.stringify(environment, null, 2)}</div>; */}
    </div>
  );
}

export function EditPlacement({ environmentId }) {
  const { isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }
  if (isErrorEnvironment) {
    return <ErrorComponent />;
  }

  const placements = [
    { name: "Bottom Right", value: "bottomRight", default: true, disabled: false },
    { name: "Top Right", value: "topRight", default: false, disabled: true },
    { name: "Top Left", value: "topLeft", default: false, disabled: true },
    { name: "Bottom Left", value: "bottomLeft", default: false, disabled: true },
    { name: "Centered Modal", value: "centered", default: false, disabled: true },
  ];

  return (
    <div className="w-full items-center">
      <div className="flex">
        <RadioGroup>
          {placements.map((placement) => (
            <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
              <RadioGroupItem
                id={placement.value}
                value={placement.value}
                checked={placement.default}
                disabled={placement.disabled}
              />
              <Label htmlFor={placement.value}>{placement.name}</Label>
            </div>
          ))}
        </RadioGroup>
        <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
          <div className="absolute bottom-3 right-3 h-16 w-16 rounded bg-slate-700"></div>
        </div>
      </div>
      <Button type="submit" className="mt-4" disabled>
        Save
      </Button>
      {/*   <div className="whitespace-pre-wrap">{JSON.stringify(environment, null, 2)}</div>; */}
    </div>
  );
}

export function EditFormbricksSignature({ environmentId }) {
  const { isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }
  if (isErrorEnvironment) {
    return <ErrorComponent />;
  }

  return (
    <div className="w-full items-center">
      <div className="flex items-center space-x-2">
        <Switch disabled id="signature" />
        <Label htmlFor="signature">Show Formbricks Signature</Label>
      </div>
      <Button type="submit" className="mt-4" disabled>
        Save
      </Button>
      {/*   <div className="whitespace-pre-wrap">{JSON.stringify(environment, null, 2)}</div>; */}
    </div>
  );
}
