"use client";

import Placement from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/Placement";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import React from "react";

import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TPlacement } from "@formbricks/types/common";
import { TSurvey } from "@formbricks/types/surveys";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import { Slider } from "@formbricks/ui/Slider";
import ColorSelectorWithLabel from "@formbricks/ui/Styling/ColorSelectorWithLabel";
import { Switch } from "@formbricks/ui/Switch";

type CardStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  disabled?: boolean;
};

const CardStylingSettings = ({
  localSurvey,
  setLocalSurvey,
  disabled,
  open,
  setOpen,
}: CardStylingSettingsProps) => {
  const { styling, productOverwrites } = localSurvey;
  const { hideProgressBar } = styling ?? {};
  const { placement, clickOutsideClose, darkOverlay } = productOverwrites ?? {};

  const cardBgColor = localSurvey.styling?.cardBackgroundColor?.light || COLOR_DEFAULTS.cardBackgroundColor;
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

  const isHighlightBorderAllowed = !!localSurvey.styling?.highlightBorderColor;
  const setIsHighlightBorderAllowed = (open: boolean) => {
    if (!open) {
      const { highlightBorderColor, ...rest } = localSurvey.styling ?? {};

      setLocalSurvey((prev) => ({
        ...prev,
        styling: {
          ...rest,
        },
      }));
    } else {
      setLocalSurvey((prev) => ({
        ...prev,
        styling: {
          ...prev.styling,
          highlightBorderColor: {
            ...(prev.styling?.highlightBorderColor ?? {}),
            light: highlightBorderColor,
          },
        },
      }));
    }
  };

  const highlightBorderColor =
    localSurvey.styling?.highlightBorderColor?.light || COLOR_DEFAULTS.highlightBorderColor;
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

  const roundness = localSurvey.styling?.roundness ?? 8;
  const setRoundness = (value: number) => {
    setLocalSurvey({
      ...localSurvey,
      styling: {
        ...localSurvey.styling,
        roundness: value,
      },
    });
  };

  const togglePlacement = () => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        placement: !!placement ? null : "bottomRight",
        clickOutsideClose: false,
        darkOverlay: false,
      },
    });
  };

  const handlePlacementChange = (placement: TPlacement) => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        placement,
      },
    });
  };

  const handleOverlay = (overlayType: string) => {
    const darkOverlay = overlayType === "dark";

    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        darkOverlay,
      },
    });
  };

  const handleClickOutsideClose = (clickOutsideClose: boolean) => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        clickOutsideClose,
      },
    });
  };

  const toggleProgressBarVisibility = () => {
    setLocalSurvey({
      ...localSurvey,
      styling: {
        ...localSurvey.styling,
        hideProgressBar: !hideProgressBar,
      },
    });
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
              <div className="flex items-center gap-2">
                <Switch checked={isHighlightBorderAllowed} onCheckedChange={setIsHighlightBorderAllowed} />
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-700">Add highlight border</h3>
                  <p className="text-xs text-slate-500">Add an outer border to your survey card</p>
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

          <div className="flex max-w-xs flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700">Roundness</h3>
              <p className="text-xs text-slate-500">Change the border radius of the card and the inputs.</p>
            </div>
            <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
              <Slider value={[roundness]} max={22} onValueChange={(value) => setRoundness(value[0])} />
            </div>
          </div>

          {/* Positioning */}
          {localSurvey.type !== "link" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center space-x-1">
                <Switch id="surveyDeadline" checked={!!placement} onCheckedChange={togglePlacement} />
                <Label htmlFor="surveyDeadline" className="cursor-pointer">
                  <div className="ml-2">
                    <h3 className="text-sm font-semibold text-slate-700">Overwrite Placement</h3>
                    <p className="text-xs font-normal text-slate-500">Change the placement of this survey.</p>
                  </div>
                </Label>
              </div>
              {placement && (
                <div className="flex items-center space-x-1 pb-4">
                  <div className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                    <div className="w-full items-center">
                      <Placement
                        currentPlacement={placement}
                        setCurrentPlacement={handlePlacementChange}
                        setOverlay={handleOverlay}
                        overlay={darkOverlay ? "dark" : "light"}
                        setClickOutsideClose={handleClickOutsideClose}
                        clickOutsideClose={!!clickOutsideClose}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center space-x-1">
            <Switch
              id="hideProgressBar"
              checked={!!hideProgressBar}
              onCheckedChange={toggleProgressBarVisibility}
            />
            <Label htmlFor="hideProgressBar" className="cursor-pointer">
              <div className="ml-2">
                <h3 className="text-sm font-semibold text-slate-700">Hide Progress Bar</h3>
                <p className="text-xs font-normal text-slate-500">
                  Disable the visibility of survey progress
                </p>
              </div>
            </Label>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

export default CardStylingSettings;
