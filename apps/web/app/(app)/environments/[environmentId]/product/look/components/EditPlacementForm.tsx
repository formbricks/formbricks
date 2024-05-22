"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { getPlacementStyle } from "@formbricks/ui/PreviewSurvey/lib/utils";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";

import { updateProductAction } from "../actions";

const placements = [
  { name: "Bottom Right", value: "bottomRight", disabled: false },
  { name: "Top Right", value: "topRight", disabled: false },
  { name: "Top Left", value: "topLeft", disabled: false },
  { name: "Bottom Left", value: "bottomLeft", disabled: false },
  { name: "Centered Modal", value: "center", disabled: false },
];

interface EditPlacementProps {
  product: TProduct;
  environmentId: string;
}

const editPlacementSchema = z.object({
  placement: z.enum(["bottomRight", "topRight", "topLeft", "bottomLeft", "center"]),
  darkOverlay: z.boolean(),
  clickOutsideClose: z.boolean(),
});

type EditPlacementFormValues = z.infer<typeof editPlacementSchema>;

export const EditPlacementForm = ({ product }: EditPlacementProps) => {
  const {
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<EditPlacementFormValues>({
    defaultValues: {
      placement: product.placement,
      darkOverlay: product.darkOverlay ?? false,
      clickOutsideClose: product.clickOutsideClose ?? false,
    },
    resolver: zodResolver(editPlacementSchema),
  });

  const currentPlacement = watch("placement");
  const darkOverlay = watch("darkOverlay");
  const clickOutsideClose = watch("clickOutsideClose");

  const overlayStyle = currentPlacement === "center" && darkOverlay ? "bg-gray-700/80" : "bg-slate-200";

  const onSubmit: SubmitHandler<EditPlacementFormValues> = async (data) => {
    try {
      await updateProductAction(product.id, {
        placement: data.placement,
        darkOverlay: data.darkOverlay,
        clickOutsideClose: data.clickOutsideClose,
      });

      toast.success("Placement updated successfully.");
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <form className="w-full items-center" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex">
        <Controller
          name="placement"
          control={control}
          render={({ field }) => (
            <RadioGroup
              {...field}
              onValueChange={(value) => {
                field.onChange(value);
              }}>
              {placements.map((placement) => (
                <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
                  <RadioGroupItem
                    id={placement.value}
                    value={placement.value}
                    disabled={placement.disabled}
                    checked={field.value === placement.value}
                  />
                  <Label htmlFor={placement.value} className="text-slate-900">
                    {placement.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
        <div
          className={cn(
            clickOutsideClose ? "" : "cursor-not-allowed",
            "relative ml-8 h-40 w-full rounded",
            overlayStyle
          )}>
          <div
            className={cn(
              "absolute h-16 w-16 cursor-default rounded bg-slate-700",
              getPlacementStyle(currentPlacement)
            )}></div>
        </div>
      </div>

      {currentPlacement === "center" && (
        <>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">Centered modal overlay color</Label>
            <Controller
              control={control}
              name="darkOverlay"
              render={({ field }) => (
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value === "darkOverlay");
                  }}
                  className="flex space-x-4">
                  <div className="flex items-center space-x-2 whitespace-nowrap">
                    <RadioGroupItem id="lightOverlay" value="lightOverlay" checked={!field.value} />
                    <Label htmlFor="lightOverlay" className="text-slate-900">
                      Light Overlay
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 whitespace-nowrap">
                    <RadioGroupItem id="darkOverlay" value="darkOverlay" checked={field.value} />
                    <Label htmlFor="darkOverlay" className="text-slate-900">
                      Dark Overlay
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">Allow users to exit by clicking outside the study</Label>
            <Controller
              control={control}
              name="clickOutsideClose"
              render={({ field }) => (
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value === "allow");
                  }}
                  className="flex space-x-4">
                  <div className="flex items-center space-x-2 whitespace-nowrap">
                    <RadioGroupItem id="disallow" value="disallow" checked={!field.value} />
                    <Label htmlFor="disallow" className="text-slate-900">
                      Don&apos;t Allow
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 whitespace-nowrap">
                    <RadioGroupItem id="allow" value="allow" checked={field.value} />
                    <Label htmlFor="allow" className="text-slate-900">
                      Allow
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>
        </>
      )}
      <Button variant="darkCTA" className="mt-4" size="sm" loading={isSubmitting}>
        Save
      </Button>
    </form>
  );
};
