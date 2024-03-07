"use client";

import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import React, { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFUALTS } from "@formbricks/lib/styling/constants";
import { TSurvey } from "@formbricks/types/surveys";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import ColorSelectorWithLabel from "@formbricks/ui/Styling/ColorSelectorWithLabel";
import { Switch } from "@formbricks/ui/Switch";

type CardStylingSettingsProps = {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  disabled?: boolean;
};

const CardStylingSettings = ({ localSurvey, setLocalSurvey, disabled }: CardStylingSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [isHighlightBorderAllowed, setIsHighlightBorderAllowed] = useState(false);

  const cardBgColor = localSurvey.styling?.cardBackgroundColor?.light || COLOR_DEFUALTS.cardBackgroundColor;
  const setCardBgColor = (color: string) => {
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        cardBackgroundColor: {
          ...(prev.styling?.cardBackgroundColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const highlightBorderColor =
    localSurvey.styling?.highlightBorderColor?.light || COLOR_DEFUALTS.highlightBorderColor;
  const setHighlightBorderColor = (color: string) => {
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        highlightBorderColor: {
          ...(prev.styling?.highlightBorderColor ?? {}),
          light: color,
        },
      },
    }));
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
          "h-full w-full cursor-pointer rounded-lg hover:bg-slate-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-white"
        )}>
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
            {/* {containsEmptyTriggers ? (
                <div className="h-8 w-8 rounded-full border border-amber-500 bg-amber-50" />
              ) : (
                <CheckCircleIcon className="h-8 w-8 text-green-400" />
              )} */}
          </div>

          <div>
            <p className="font-semibold text-slate-800">Card Styling</p>
            <p className="mt-1 text-sm text-slate-500">Style the survey card.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <ColorSelectorWithLabel
            label="Card Background color"
            color={cardBgColor}
            setColor={setCardBgColor}
            description="Change the highlight color used for buttons, selects, etc."
          />

          {localSurvey.type === "web" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-6">
                <Switch checked={isHighlightBorderAllowed} onCheckedChange={setIsHighlightBorderAllowed} />
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold">Add highlight border</h3>
                  <p className="text-sm text-slate-800">Add an outer border to your survey card</p>
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
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

export default CardStylingSettings;
