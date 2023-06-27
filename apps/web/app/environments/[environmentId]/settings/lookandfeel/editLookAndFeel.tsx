"use client";

import { cn } from "@formbricks/lib/cn";
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
        variant="darkCTA"
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
    </div>
  );
}

export function EditPlacement({ environmentId }) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { triggerProductMutate, isMutatingProduct } = useProductMutation(environmentId);

  const [currentPlacement, setCurrentPlacement] = useState("");

  useEffect(() => {
    if (product) setCurrentPlacement(product.placement);
  }, [product]);

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <ErrorComponent />;
  }

  const placements = [
    { name: "Bottom Right", value: "bottomRight", disabled: false },
    { name: "Top Right", value: "topRight", disabled: false },
    { name: "Top Left", value: "topLeft", disabled: false },
    { name: "Bottom Left", value: "bottomLeft", disabled: false },
    { name: "Centered Modal", value: "center", disabled: false },
  ];

  return (
    <div className="w-full items-center">
      <div className="flex">
        <RadioGroup onValueChange={(e) => setCurrentPlacement(e)} value={currentPlacement}>
          {placements.map((placement) => (
            <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
              <RadioGroupItem id={placement.value} value={placement.value} disabled={placement.disabled} />
              <Label
                htmlFor={placement.value}
                className={cn(placement.disabled ? "cursor-not-allowed text-slate-500" : "text-slate-900")}>
                {placement.name}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
          <div className={cn("absolute h-16 w-16 rounded bg-slate-700", currentPlacement)}></div>
        </div>
      </div>
      <Button
        type="submit"
        variant="darkCTA"
        className="mt-4"
        loading={isMutatingProduct}
        onClick={() => {
          triggerProductMutate({ placement: currentPlacement })
            .then(() => {
              toast.success("Placement updated successfully.");
            })
            .catch((error) => {
              toast.error(`Error: ${error.message}`);
            });
        }}>
        Save
      </Button>
    </div>
  );
}

export function EditFormbricksSignature({ environmentId }) {
  const { isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { triggerProductMutate, isMutatingProduct } = useProductMutation(environmentId);

  const [formbricksSignature, setFormbricksSignature] = useState(false);

  useEffect(() => {
    if (product) {
      setFormbricksSignature(product.formbricksSignature);
    }
  }, [product]);

  const toggleSignature = () => {
    const newSignatureState = !formbricksSignature;
    setFormbricksSignature(newSignatureState);
    triggerProductMutate({ formbricksSignature: newSignatureState })
      .then(() => {
        toast.success(newSignatureState ? "Formbricks signature shown." : "Formbricks signature hidden.");
      })
      .catch((error) => {
        toast.error(`Error: ${error.message}`);
      });
  };

  if (isLoadingEnvironment || isLoadingProduct) {
    return <LoadingSpinner />;
  }

  if (isErrorEnvironment || isErrorProduct) {
    return <ErrorComponent />;
  }

  if (formbricksSignature !== null) {
    return (
      <div className="w-full items-center">
        <div className="flex items-center space-x-2">
          <Switch
            id="signature"
            checked={formbricksSignature}
            onCheckedChange={toggleSignature}
            disabled={isMutatingProduct}
          />
          <Label htmlFor="signature">Show &apos;Powered by Formbricks&apos; Signature</Label>
        </div>
      </div>
    );
  }

  return null;
}
