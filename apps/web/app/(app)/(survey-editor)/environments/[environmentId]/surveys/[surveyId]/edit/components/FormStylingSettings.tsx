"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon, SparklesIcon } from "lucide-react";
import React from "react";
import { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { mixColor } from "@formbricks/lib/utils";
import { TProduct, TProductStyling } from "@formbricks/types/product";
import { TBaseStyling } from "@formbricks/types/styling";
import { TSurveyStyling } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormField } from "@formbricks/ui/Form";
import { ColorSelectorWithLabel } from "@formbricks/ui/Styling";

type FormStylingSettingsProps = {
  styling: TSurveyStyling | TProductStyling | null;
  setStyling: React.Dispatch<React.SetStateAction<TSurveyStyling | TProductStyling>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsPage?: boolean;
  disabled?: boolean;
  form: UseFormReturn<TProductStyling | TSurveyStyling>;
};

export const FormStylingSettings = ({
  styling,
  setStyling,
  open,
  isSettingsPage = false,
  disabled = false,
  setOpen,
  form,
}: FormStylingSettingsProps) => {
  const brandColor = form.watch("brandColor.light") || COLOR_DEFAULTS.brandColor;
  const questionColor = form.watch("questionColor.light") || COLOR_DEFAULTS.questionColor;
  const inputColor = form.watch("inputColor.light") || COLOR_DEFAULTS.inputColor;
  const inputBorderColor = form.watch("inputBorderColor.light") || COLOR_DEFAULTS.inputBorderColor;

  const setQuestionColor = (color: string) => form.setValue("questionColor.light", color);
  const setInputColor = (color: string) => form.setValue("inputColor.light", color);
  const setInputBorderColor = (color: string) => form.setValue("inputBorderColor.light", color);

  const suggestColors = () => {
    // mix the brand color with different weights of white and set the result as the other colors
    setQuestionColor(mixColor(brandColor, "#000000", 0.35));
    setInputColor(mixColor(brandColor, "#ffffff", 0.92));
    setInputBorderColor(mixColor(brandColor, "#ffffff", 0.6));

    // // card background, border and shadow colors
    // setStyling((prev) => ({
    //   ...prev,
    //   cardBackgroundColor: {
    //     ...(prev.cardBackgroundColor ?? {}),
    //     light: mixColor(brandColor, "#ffffff", 0.97),
    //   },
    //   cardBorderColor: {
    //     ...(prev.cardBorderColor ?? {}),
    //     light: mixColor(brandColor, "#ffffff", 0.8),
    //   },
    //   cardShadowColor: {
    //     ...(prev.cardShadowColor ?? {}),
    //     light: brandColor,
    //   },
    // }));

    // if (!styling?.background || styling?.background?.bgType === "color") {
    //   setStyling((prev) => ({
    //     ...prev,
    //     background: {
    //       ...(prev.background ?? {}),
    //       bg: mixColor(brandColor, "#ffffff", 0.855),
    //       bgType: "color",
    //     },
    //   }));
    // }

    // if (styling?.highlightBorderColor) {
    //   setStyling((prev) => ({
    //     ...prev,
    //     highlightBorderColor: {
    //       ...(prev.highlightBorderColor ?? {}),
    //       light: mixColor(brandColor, "#ffffff", 0.25),
    //     },
    //   }));
    // }
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
                <ColorSelectorWithLabel
                  label="Brand color"
                  color={field.value || COLOR_DEFAULTS.brandColor}
                  setColor={(color) => field.onChange(color)}
                  description="Change the brand color of the survey"
                />
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
              <ColorSelectorWithLabel
                label="Question color"
                color={questionColor}
                setColor={(color) => field.onChange(color)}
                description="Change the question color of the survey"
              />
            )}
          />

          <FormField
            control={form.control}
            name="inputColor.light"
            render={({ field }) => (
              <ColorSelectorWithLabel
                label="Input color"
                color={inputColor}
                setColor={(color: string) => field.onChange(color)}
                description="Change the background color of the input fields."
              />
            )}
          />

          <FormField
            control={form.control}
            name="inputBorderColor.light"
            render={({ field }) => (
              <ColorSelectorWithLabel
                label="Input border color"
                color={inputBorderColor}
                setColor={(color: string) => field.onChange(color)}
                description="Change the border color of the input fields."
              />
            )}
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
