"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, SparklesIcon } from "lucide-react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { mixColor } from "@formbricks/lib/utils/colors";
import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@formbricks/ui/Form";

type FormStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsPage?: boolean;
  disabled?: boolean;
  form: UseFormReturn<TProductStyling | TSurveyStyling>;
};

export const FormStylingSettings = ({
  open,
  isSettingsPage = false,
  disabled = false,
  setOpen,
  form,
}: FormStylingSettingsProps) => {
  const brandColor = form.watch("brandColor.light") || COLOR_DEFAULTS.brandColor;
  const background = form.watch("background");
  const highlightBorderColor = form.watch("highlightBorderColor");

  const setQuestionColor = (color: string) => form.setValue("questionColor.light", color);
  const setInputColor = (color: string) => form.setValue("inputColor.light", color);
  const setInputBorderColor = (color: string) => form.setValue("inputBorderColor.light", color);
  const setCardBackgroundColor = (color: string) => form.setValue("cardBackgroundColor.light", color);
  const setCardBorderColor = (color: string) => form.setValue("cardBorderColor.light", color);
  const setCardShadowColor = (color: string) => form.setValue("cardShadowColor.light", color);
  const setBackgroundColor = (color: string) => {
    form.setValue("background", {
      bg: color,
      bgType: "color",
    });
  };
  const setHighlightBorderColor = (color: string) => {
    form.setValue("highlightBorderColor", { light: mixColor(color, "#ffffff", 0.25) });
  };

  const suggestColors = () => {
    // mix the brand color with different weights of white and set the result as the other colors
    setQuestionColor(mixColor(brandColor, "#000000", 0.35));
    setInputColor(mixColor(brandColor, "#ffffff", 0.92));
    setInputBorderColor(mixColor(brandColor, "#ffffff", 0.6));

    setCardBackgroundColor(mixColor(brandColor, "#ffffff", 0.97));
    setCardBorderColor(mixColor(brandColor, "#ffffff", 0.8));
    setCardShadowColor(brandColor);

    if (!background || background?.bgType === "color") {
      setBackgroundColor(mixColor(brandColor, "#ffffff", 0.855));
    }

    if (!highlightBorderColor) {
      setHighlightBorderColor(brandColor);
    }
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
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

          <div>
            <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
              Form Styling
            </p>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              Style the question texts, descriptions and input fields.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <div className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="brandColor.light"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <div>
                    <FormLabel>Brand color</FormLabel>
                    <FormDescription>Change the brand color of the survey.</FormDescription>
                  </div>

                  <FormControl>
                    <ColorPicker
                      color={field.value || COLOR_DEFAULTS.brandColor}
                      onChange={(color) => field.onChange(color)}
                      containerClass="max-w-xs"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              EndIcon={SparklesIcon}
              className="w-fit"
              onClick={() => suggestColors()}>
              Suggest colors
            </Button>
          </div>

          <FormField
            control={form.control}
            name="questionColor.light"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div>
                  <FormLabel>Question color</FormLabel>
                  <FormDescription>Change the question color of the survey.</FormDescription>
                </div>

                <FormControl>
                  <ColorPicker
                    color={field.value || COLOR_DEFAULTS.questionColor}
                    onChange={(color) => field.onChange(color)}
                    containerClass="max-w-xs"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="inputColor.light"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div>
                  <FormLabel>Input color</FormLabel>
                  <FormDescription>Change the background color of the input fields.</FormDescription>
                </div>

                <FormControl>
                  <ColorPicker
                    color={field.value || COLOR_DEFAULTS.inputColor}
                    onChange={(color: string) => field.onChange(color)}
                    containerClass="max-w-xs"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="inputBorderColor.light"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div>
                  <FormLabel>Input border color</FormLabel>
                  <FormDescription>Change the border color of the input fields.</FormDescription>
                </div>

                <FormControl>
                  <ColorPicker
                    color={field.value || COLOR_DEFAULTS.inputBorderColor}
                    onChange={(color: string) => field.onChange(color)}
                    containerClass="max-w-xs"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
