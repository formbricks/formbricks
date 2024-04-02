"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import React, { useMemo } from "react";

import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys";
import { Badge } from "@formbricks/ui/Badge";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import { Slider } from "@formbricks/ui/Slider";
import { ColorSelectorWithLabel } from "@formbricks/ui/Styling";
import { Switch } from "@formbricks/ui/Switch";

type CardStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  styling: TSurveyStyling | TProductStyling | null;
  setStyling: React.Dispatch<React.SetStateAction<TSurveyStyling | TProductStyling>>;
  hideCheckmark?: boolean;
  surveyType?: TSurveyType;
  disabled?: boolean;
};

const CardStylingSettings = ({
  setStyling,
  styling,
  hideCheckmark,
  surveyType,
  disabled,
  open,
  setOpen,
}: CardStylingSettingsProps) => {
  const cardBgColor = styling?.cardBackgroundColor?.light || COLOR_DEFAULTS.cardBackgroundColor;
  const setCardBgColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      cardBackgroundColor: {
        ...(prev.cardBackgroundColor ?? {}),
        light: color,
      },
    }));
  };

  const cardBorderColor = styling?.cardBorderColor?.light || COLOR_DEFAULTS.cardBorderColor;
  const setCardBorderColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      cardBorderColor: {
        ...(prev.cardBorderColor ?? {}),
        light: color,
      },
    }));
  };

  const cardShadowColor = styling?.cardShadowColor?.light || COLOR_DEFAULTS.cardShadowColor;
  const setCardShadowColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      cardShadowColor: {
        ...(prev.cardShadowColor ?? {}),
        light: color,
      },
    }));
  };

  const isHighlightBorderAllowed = !!styling?.highlightBorderColor;
  const setIsHighlightBorderAllowed = (open: boolean) => {
    if (!open) {
      const { highlightBorderColor, ...rest } = styling ?? {};

      setStyling({
        ...rest,
      });
    } else {
      setStyling((prev) => ({
        ...prev,
        highlightBorderColor: {
          ...(prev.highlightBorderColor ?? {}),
          light: COLOR_DEFAULTS.highlightBorderColor,
        },
      }));
    }
  };

  const highlightBorderColor = styling?.highlightBorderColor?.light || COLOR_DEFAULTS.highlightBorderColor;
  const setHighlightBorderColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      highlightBorderColor: {
        ...(prev.highlightBorderColor ?? {}),
        light: color,
      },
    }));
  };

  const roundness = styling?.roundness ?? 8;
  const setRoundness = (value: number) => {
    setStyling((prev) => ({
      ...prev,
      roundness: value,
    }));
  };

  const toggleProgressBarVisibility = (hideProgressBar: boolean) => {
    setStyling({
      ...styling,
      hideProgressBar,
    });
  };

  const hideProgressBar = useMemo(() => {
    return styling?.hideProgressBar;
  }, [styling]);

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
          "h-full w-full cursor-pointer rounded-lg hover:bg-slate-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-white"
        )}>
        <div className="inline-flex px-4 py-4">
          {!hideCheckmark && (
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
          )}

          <div>
            <p className="font-semibold text-slate-800">Card Styling</p>
            <p className="mt-1 text-sm text-slate-500">Style the survey card.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <div className="flex max-w-xs flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700">Roundness</h3>
              <p className="text-xs text-slate-500">Change the border radius of the card and the inputs.</p>
            </div>
            <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
              <Slider value={[roundness]} max={22} onValueChange={(value) => setRoundness(value[0])} />
            </div>
          </div>

          <ColorSelectorWithLabel
            label="Card background color"
            color={cardBgColor}
            setColor={setCardBgColor}
            description="Change the background color of the card."
          />

          <ColorSelectorWithLabel
            label="Card border color"
            color={cardBorderColor}
            setColor={setCardBorderColor}
            description="Change the border color of the card."
          />

          <ColorSelectorWithLabel
            label="Card shadow color"
            color={cardShadowColor}
            setColor={setCardShadowColor}
            description="Change the shadow color of the card."
          />

          <>
            <div className="flex items-center space-x-1">
              <Switch
                id="hideProgressBar"
                checked={!!hideProgressBar}
                onCheckedChange={(checked) => toggleProgressBarVisibility(checked)}
              />
              <Label htmlFor="hideProgressBar" className="cursor-pointer">
                <div className="ml-2">
                  <h3 className="text-sm font-semibold text-slate-700">Hide Progress Bar</h3>
                  <p className="text-xs font-normal text-slate-500">
                    Disable the visibility of survey progress.
                  </p>
                </div>
              </Label>
            </div>

            {(!surveyType || surveyType === "web") && (
              <div className="flex max-w-xs flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={isHighlightBorderAllowed} onCheckedChange={setIsHighlightBorderAllowed} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-700">Add highlight border</h3>
                      <Badge text="In-App Surveys" type="gray" size="normal" />
                    </div>
                    <p className="text-xs text-slate-500">Add an outer border to your survey card.</p>
                  </div>
                </div>

                {isHighlightBorderAllowed && (
                  <ColorPicker
                    color={highlightBorderColor}
                    onChange={setHighlightBorderColor}
                    containerClass="my-0"
                  />
                )}
              </div>
            )}
          </>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

export default CardStylingSettings;
