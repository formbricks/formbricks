"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TPlacement } from "@formbricks/types/common";
import { TSurvey, TSurveyBackgroundBgType } from "@formbricks/types/surveys";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";

import Placement from "./Placement";
import SurveyBgSelectorTab from "./SurveyBgSelectorTab";

interface StylingCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colours: string[];
  environmentId: string;
}

export default function StylingCard({
  localSurvey,
  setLocalSurvey,
  colours,
  environmentId,
}: StylingCardProps) {
  const [open, setOpen] = useState(localSurvey.type === "link" ? true : false);
  const progressBarHidden = localSurvey.styling?.hideProgressBar ?? false;
  const { type, productOverwrites, styling } = localSurvey;
  const { brandColor, clickOutsideClose, darkOverlay, placement, highlightBorderColor } =
    productOverwrites ?? {};
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

  const toggleBrandColor = () => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        brandColor: !!brandColor ? null : "#64748b",
      },
    });
  };

  const toggleHighlightBorderColor = () => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        highlightBorderColor: !!highlightBorderColor ? null : "#64748b",
      },
    });
  };

  const handleColorChange = (color: string) => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        brandColor: color,
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

  const handleBorderColorChange = (color: string) => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        highlightBorderColor: color,
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

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border bg-green-400 p-1.5 text-white"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Styling</p>
            <p className="mt-1 truncate text-sm text-slate-500">Overwrite global styling settings</p>
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
          {/* Brand Color */}
          <div className="p-3">
            <div className="ml-2 flex items-center space-x-1">
              <Switch id="autoComplete" checked={!!brandColor} onCheckedChange={toggleBrandColor} />
              <Label htmlFor="autoComplete" className="cursor-pointer">
                <div className="ml-2">
                  <h3 className="text-sm font-semibold text-slate-700">Overwrite Brand Color</h3>
                  <p className="text-xs font-normal text-slate-500">Change the main color for this survey.</p>
                </div>
              </Label>
            </div>
            {brandColor && (
              <div className="ml-2 mt-4 rounded-lg border bg-slate-50 p-4">
                <div className="w-full max-w-xs">
                  <Label htmlFor="brandcolor">Color (HEX)</Label>
                  <ColorPicker color={brandColor} onChange={handleColorChange} />
                </div>
              </div>
            )}
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
          {/* Highlight border */}
          {type !== "link" && (
            <div className="p-3 ">
              <div className="ml-2 flex items-center space-x-1">
                <Switch
                  id="autoComplete"
                  checked={!!highlightBorderColor}
                  onCheckedChange={toggleHighlightBorderColor}
                />
                <Label htmlFor="autoComplete" className="cursor-pointer">
                  <div className="ml-2">
                    <h3 className="text-sm font-semibold text-slate-700">Overwrite Highlight Border</h3>
                    <p className="text-xs font-normal text-slate-500">
                      Change the highlight border for this survey.
                    </p>
                  </div>
                </Label>
              </div>
              {!!highlightBorderColor && (
                <div className="ml-2 mt-4 rounded-lg border bg-slate-50 p-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="highlightBorder"
                      checked={!!highlightBorderColor}
                      onCheckedChange={toggleHighlightBorderColor}
                    />
                    <h2 className="text-sm font-medium text-slate-800">Show highlight border</h2>
                  </div>
                  {!!highlightBorderColor && (
                    <div className="mt-6 w-full max-w-xs">
                      <Label htmlFor="brandcolor">Color (HEX)</Label>
                      <ColorPicker color={highlightBorderColor || ""} onChange={handleBorderColorChange} />
                    </div>
                  )}
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
