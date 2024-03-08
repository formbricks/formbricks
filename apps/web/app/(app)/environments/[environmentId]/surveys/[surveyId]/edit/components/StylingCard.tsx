"use client";

import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TPlacement } from "@formbricks/types/common";
import { TSurvey, TSurveyBackgroundBgType } from "@formbricks/types/surveys";
import { Label } from "@formbricks/ui/Label";
import { Slider } from "@formbricks/ui/Slider";
import { Switch } from "@formbricks/ui/Switch";

import Placement from "./Placement";
import SurveyBgSelectorTab from "./SurveyBgSelectorTab";

interface StylingCardProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colours: string[];
  environmentId: string;
  disabled?: boolean;
}

export default function StylingCard({
  open,
  setOpen,
  localSurvey,
  setLocalSurvey,
  colours,
  environmentId,
  disabled,
}: StylingCardProps) {
  const progressBarHidden = localSurvey.styling?.hideProgressBar ?? false;
  const { type, productOverwrites, styling } = localSurvey;
  const { clickOutsideClose, darkOverlay, placement } = productOverwrites ?? {};
  const { bgType } = styling?.background ?? {};

  const [inputValue, setInputValue] = useState(100);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    handleBrightnessChange(parseInt(e.target.value));
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

  const handleBgChange = (color: string, type: TSurveyBackgroundBgType) => {
    setInputValue(100);
    setLocalSurvey({
      ...localSurvey,
      styling: {
        ...localSurvey.styling,
        background: {
          ...localSurvey.styling?.background,
          bg: color,
          bgType: type,
          brightness: undefined,
        },
      },
    });
  };

  const handleBrightnessChange = (percent: number) => {
    setLocalSurvey({
      ...localSurvey,
      styling: {
        ...(localSurvey.styling || {}),
        background: {
          ...localSurvey.styling?.background,
          brightness: percent,
        },
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
        hideProgressBar: !progressBarHidden,
      },
    });
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

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
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
            <p className="font-semibold text-slate-800">Background Styling</p>
            <p className="mt-1 truncate text-sm text-slate-500">
              Change the background to a color, image or animation.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="p-3">
          {type == "link" && (
            <>
              <>
                {/* Background */}
                <div className="p-3">
                  <div className="ml-2">
                    <h3 className="text-sm font-semibold text-slate-700">Change Background</h3>
                    <p className="text-xs font-normal text-slate-500">
                      Pick a background from our library or upload your own.
                    </p>
                  </div>
                  <SurveyBgSelectorTab
                    localSurvey={localSurvey}
                    handleBgChange={handleBgChange}
                    colours={colours}
                    bgType={bgType}
                  />
                </div>

                {/* Overlay */}
                <div className="my-3 p-3">
                  <div className="ml-2">
                    <h3 className="text-sm font-semibold text-slate-700">Background Overlay</h3>
                    <p className="text-xs font-normal text-slate-500">
                      Darken or lighten background of your choice.
                    </p>
                  </div>
                  <div>
                    <div className="mt-4 flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
                      <h3 className="mb-4 text-sm font-semibold text-slate-700">Brightness</h3>
                      <input
                        id="small-range"
                        type="range"
                        min="1"
                        max="200"
                        value={inputValue}
                        onChange={handleInputChange}
                        className="range-sm mb-6 h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </>
            </>
          )}

          <div className="my-3 flex flex-col gap-4 p-3">
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700">Roundness</h3>
              <p className="text-xs text-slate-500">Change the border radius of the card and the inputs.</p>
            </div>
            <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
              <Slider value={[roundness]} max={16} onValueChange={(value) => setRoundness(value[0])} />
            </div>
          </div>

          {/* Positioning */}
          {type !== "link" && (
            <div className="p-3 ">
              <div className="ml-2 flex items-center space-x-1">
                <Switch id="surveyDeadline" checked={!!placement} onCheckedChange={togglePlacement} />
                <Label htmlFor="surveyDeadline" className="cursor-pointer">
                  <div className="ml-2">
                    <h3 className="text-sm font-semibold text-slate-700">Overwrite Placement</h3>
                    <p className="text-xs font-normal text-slate-500">Change the placement of this survey.</p>
                  </div>
                </Label>
              </div>
              {placement && (
                <div className="ml-2 mt-4 flex items-center space-x-1 pb-4">
                  <div className="flex w-full cursor-pointer items-center rounded-lg  border bg-slate-50 p-4">
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

          <div className="p-3">
            <div className="ml-2 flex items-center space-x-1">
              <Switch
                id="hideProgressBar"
                checked={progressBarHidden}
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
          <div className="mt-2 flex items-center space-x-3 rounded-lg px-4 py-2 text-slate-500">
            <p className="text-xs">
              To keep the styling over all surveys consistent, you can{" "}
              <Link
                href={`/environments/${environmentId}/settings/lookandfeel`}
                className="underline hover:text-slate-900"
                target="_blank">
                set global styles in the Look & Feel settings.
              </Link>{" "}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
