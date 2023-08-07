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
import { getPlacementStyle } from "@/lib/preview";
import { PlacementType } from "@formbricks/types/js";
import { DEFAULT_BRAND_COLOR } from "@formbricks/lib/constants";

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

export function Placement({
  setCurrentPlacement,
  currentPlacement,
  setOverlay,
  overlay,
  setClickOutside,
  clickOutside,
}) {
  const placements = [
    { name: "Bottom Right", value: "bottomRight", disabled: false },
    { name: "Top Right", value: "topRight", disabled: false },
    { name: "Top Left", value: "topLeft", disabled: false },
    { name: "Bottom Left", value: "bottomLeft", disabled: false },
    { name: "Centered Modal", value: "center", disabled: false },
  ];

  return (
    <>
      <div className="flex">
        <RadioGroup onValueChange={(e) => setCurrentPlacement(e as PlacementType)} value={currentPlacement}>
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
          <div
            className={cn(
              "absolute h-16 w-16 rounded bg-slate-700",
              getPlacementStyle(currentPlacement)
            )}></div>
        </div>
      </div>
      {currentPlacement === "center" && (
        <>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">Centered modal overlay color</Label>
            <RadioGroup onValueChange={(e) => setOverlay(e)} value={overlay} className="flex space-x-4">
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="lightOverlay" value="lightOverlay" />
                <Label htmlFor="lightOverlay" className="text-slate-900">
                  Light Overlay
                </Label>
              </div>
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="darkOverlay" value="darkOverlay" />
                <Label htmlFor="darkOverlay" className="text-slate-900">
                  Dark Overlay
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">Allow users to exit by clicking outside the study</Label>
            <RadioGroup
              onValueChange={(e) => setClickOutside(e)}
              value={clickOutside}
              className="flex space-x-4">
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="disallow" value="disallow" />
                <Label htmlFor="disallow" className="text-slate-900">
                  Don&apos;t Allow
                </Label>
              </div>
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="allow" value="allow" />
                <Label htmlFor="allow" className="text-slate-900">
                  Allow
                </Label>
              </div>
            </RadioGroup>
          </div>
        </>
      )}
    </>
  );
}
export function EditPlacement({ environmentId }) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { triggerProductMutate, isMutatingProduct } = useProductMutation(environmentId);

  const [currentPlacement, setCurrentPlacement] = useState<PlacementType>("bottomRight");
  const [overlay, setOverlay] = useState("");
  const [clickOutside, setClickOutside] = useState("");

  useEffect(() => {
    if (product) {
      setCurrentPlacement(product.placement);
      setOverlay(product.darkOverlay ? "darkOverlay" : "lightOverlay");
      setClickOutside(product.clickOutsideClose ? "allow" : "disallow");
    }
  }, [product]);

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <ErrorComponent />;
  }

  return (
    <div className="w-full items-center">
      <Placement
        currentPlacement={currentPlacement}
        setCurrentPlacement={setCurrentPlacement}
        setOverlay={setOverlay}
        overlay={overlay}
        setClickOutside={setClickOutside}
        clickOutside={clickOutside}
      />
      <Button
        type="submit"
        variant="darkCTA"
        className="mt-4"
        loading={isMutatingProduct}
        onClick={() => {
          triggerProductMutate({
            placement: currentPlacement,
            darkOverlay: overlay === "darkOverlay",
            clickOutsideClose: clickOutside === "allow",
          })
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

export const EditHighlightBorder: React.FC<{ environmentId: string }> = ({ environmentId }) => {
  const { product, isLoadingProduct, isErrorProduct, mutateProduct } = useProduct(environmentId);
  const { triggerProductMutate, isMutatingProduct } = useProductMutation(environmentId);

  const [showHighlightBorder, setShowHighlightBorder] = useState(false);
  const [color, setColor] = useState<string | null>(DEFAULT_BRAND_COLOR);

  // Sync product state with local state
  // not a good pattern, we should find a better way to do this
  useEffect(() => {
    if (product) {
      setShowHighlightBorder(product.highlightBorderColor ? true : false);
      setColor(product.highlightBorderColor);
    }
  }, [product]);

  const handleSave = () => {
    triggerProductMutate(
      { highlightBorderColor: color },
      {
        onSuccess: () => {
          toast.success("Settings updated successfully.");
          // refetch product to update data
          mutateProduct();
        },
        onError: () => {
          toast.error("Something went wrong!");
        },
      }
    );
  };

  const handleSwitch = (checked: boolean) => {
    if (checked) {
      if (!color) {
        setColor(DEFAULT_BRAND_COLOR);
        setShowHighlightBorder(true);
      } else {
        setShowHighlightBorder(true);
      }
    } else {
      setShowHighlightBorder(false);
      setColor(null);
    }
  };

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }

  if (isErrorProduct) {
    return <div>Error</div>;
  }

  return (
    <div className="flex min-h-full w-full">
      <div className="flex w-1/2 flex-col px-6 py-5">
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
          type="submit"
          variant="darkCTA"
          className="mt-4 flex max-w-[80px] items-center justify-center"
          loading={isMutatingProduct}
          onClick={() => {
            handleSave();
          }}>
          Save
        </Button>
      </div>

      <div className="flex w-1/2 flex-col items-center justify-center gap-4 bg-slate-200 px-6 py-5">
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
          <div className="flex rounded-2xl border border-slate-400">
            {[1, 2, 3, 4, 5].map((num) => (
              <div className="border-r border-slate-400 px-6 py-5 last:border-r-0">
                <span className="text-sm font-medium">{num}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

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
