"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { cn } from "@formbricks/lib/cn";
import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/components/Button";
import { FormControl, FormField, FormItem, FormLabel, FormProvider } from "@formbricks/ui/components/Form";
import { Label } from "@formbricks/ui/components/Label";
import { getPlacementStyle } from "@formbricks/ui/components/PreviewSurvey/lib/utils";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/components/RadioGroup";
import { updateProductAction } from "../../actions";

const placements = [
  { name: "common.bottom_right", value: "bottomRight", disabled: false },
  { name: "common.top_right", value: "topRight", disabled: false },
  { name: "common.top_left", value: "topLeft", disabled: false },
  { name: "common.bottom_left", value: "bottomLeft", disabled: false },
  { name: "common.centered_modal", value: "center", disabled: false },
];

interface EditPlacementProps {
  product: TProduct;
  environmentId: string;
}

const ZProductPlacementInput = z.object({
  placement: z.enum(["bottomRight", "topRight", "topLeft", "bottomLeft", "center"]),
  darkOverlay: z.boolean(),
  clickOutsideClose: z.boolean(),
});

type EditPlacementFormValues = z.infer<typeof ZProductPlacementInput>;

export const EditPlacementForm = ({ product }: EditPlacementProps) => {
  const t = useTranslations();
  const form = useForm<EditPlacementFormValues>({
    defaultValues: {
      placement: product.placement,
      darkOverlay: product.darkOverlay ?? false,
      clickOutsideClose: product.clickOutsideClose ?? false,
    },
    resolver: zodResolver(ZProductPlacementInput),
  });

  const currentPlacement = form.watch("placement");
  const darkOverlay = form.watch("darkOverlay");
  const clickOutsideClose = form.watch("clickOutsideClose");
  const isSubmitting = form.formState.isSubmitting;

  const overlayStyle = currentPlacement === "center" && darkOverlay ? "bg-slate-700/80" : "bg-slate-200";

  const onSubmit: SubmitHandler<EditPlacementFormValues> = async (data) => {
    try {
      await updateProductAction({
        productId: product.id,
        data: {
          placement: data.placement,
          darkOverlay: data.darkOverlay,
          clickOutsideClose: data.clickOutsideClose,
        },
      });

      toast.success(t("environments.product.look.placement_updated_successfully"));
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <FormProvider {...form}>
      <form className="w-full items-center" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex">
          <FormField
            control={form.control}
            name="placement"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    {...field}
                    onValueChange={(value) => {
                      field.onChange(value);
                    }}
                    className="h-full">
                    {placements.map((placement) => (
                      <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
                        <RadioGroupItem
                          id={placement.value}
                          value={placement.value}
                          disabled={placement.disabled}
                          checked={field.value === placement.value}
                        />
                        <Label htmlFor={placement.value} className="text-slate-900">
                          {t(placement.name)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
              </FormItem>
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
              <FormField
                control={form.control}
                name="darkOverlay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">
                      {t("environments.product.look.centered_modal_overlay_color")}
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value === "darkOverlay");
                        }}
                        className="flex space-x-4">
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <RadioGroupItem id="lightOverlay" value="lightOverlay" checked={!field.value} />
                          <Label htmlFor="lightOverlay" className="text-slate-900">
                            {t("common.light_overlay")}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <RadioGroupItem id="darkOverlay" value="darkOverlay" checked={field.value} />
                          <Label htmlFor="darkOverlay" className="text-slate-900">
                            {t("common.dark_overlay")}
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-6 space-y-2">
              <FormField
                control={form.control}
                name="clickOutsideClose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">
                      {t("common.allow_users_to_exit_by_clicking_outside_the_survey")}
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value === "allow");
                        }}
                        className="flex space-x-4">
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <RadioGroupItem id="disallow" value="disallow" checked={!field.value} />
                          <Label htmlFor="disallow" className="text-slate-900">
                            {t("common.disallow")}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 whitespace-nowrap">
                          <RadioGroupItem id="allow" value="allow" checked={field.value} />
                          <Label htmlFor="allow" className="text-slate-900">
                            {t("common.allow")}
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </>
        )}

        <Button className="mt-4 w-fit" size="sm" loading={isSubmitting}>
          {t("common.save")}
        </Button>
      </form>
    </FormProvider>
  );
};
