"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { cn } from "@formbricks/lib/cn";
import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { Badge } from "@formbricks/ui/Badge";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@formbricks/ui/Form";
import { Slider } from "@formbricks/ui/Slider";
import { SurveyBgSelectorTab } from "./SurveyBgSelectorTab";

interface BackgroundStylingCardProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  colors: string[];
  isSettingsPage?: boolean;
  disabled?: boolean;
  environmentId: string;
  isUnsplashConfigured: boolean;
  form: UseFormReturn<TProductStyling | TSurveyStyling>;
}

export const BackgroundStylingCard = ({
  open,
  setOpen,
  colors,
  isSettingsPage = false,
  disabled,
  environmentId,
  isUnsplashConfigured,
  form,
}: BackgroundStylingCardProps) => {
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
      <Collapsible.CollapsibleTrigger
        asChild
        disabled={disabled}
        className={cn(
          "w-full cursor-pointer rounded-lg hover:bg-slate-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-white"
        )}>
        <div className="inline-flex px-4 py-4">
          {!isSettingsPage && (
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
                Background Styling
              </p>
              {isSettingsPage && <Badge text="Link Surveys" type="gray" size="normal" />}
            </div>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              Change the background to a color, image or animation.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="pt-1 text-slate-600" />
        <div className="flex flex-col gap-6 p-6 pt-2">
          <FormField
            control={form.control}
            name="background"
            render={({ field }) => (
              <FormItem>
                <div>
                  <FormLabel>Change background</FormLabel>
                  <FormDescription>Pick a background from our library or upload your own.</FormDescription>
                </div>

                <FormControl>
                  <SurveyBgSelectorTab
                    bg={field.value?.bg ?? ""}
                    handleBgChange={(bg: string, bgType: string) => {
                      field.onChange({
                        ...field.value,
                        bg,
                        bgType,
                        brightness: 100,
                      });
                    }}
                    colors={colors}
                    bgType={field.value?.bgType ?? "color"}
                    environmentId={environmentId}
                    isUnsplashConfigured={isUnsplashConfigured}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex flex-col justify-center">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col justify-center">
                <FormField
                  control={form.control}
                  name="background.brightness"
                  render={({ field }) => (
                    <FormItem>
                      <div>
                        <FormLabel>Brightness</FormLabel>
                        <FormDescription>Darken or lighten background of your choice.</FormDescription>
                      </div>

                      <FormControl>
                        <div className="rounded-lg border bg-slate-50 p-6">
                          <Slider
                            value={[field.value ?? 100]}
                            max={200}
                            onValueChange={(value) => {
                              field.onChange(value[0]);
                            }}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
