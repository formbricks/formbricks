"use client";

import { PlacementType } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import Placement from "./Placement";

interface StylingCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
}

export default function StylingCard({ localSurvey, setLocalSurvey }: StylingCardProps) {
  const [open, setOpen] = useState(false);

  const { type, productOverwrites } = localSurvey;
  const { brandColor, clickOutside, darkOverlay, placement, highlightBorderColor } = productOverwrites ?? {};

  const togglePlacement = () => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        placement: !!placement ? null : "bottomRight",
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

  const handleBorderColorChange = (color: string) => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        highlightBorderColor: color,
      },
    });
  };

  const handlePlacementChange = (placement: PlacementType) => {
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

  const handleClickOutside = (clickOutside: boolean) => {
    setLocalSurvey({
      ...localSurvey,
      productOverwrites: {
        ...localSurvey.productOverwrites,
        clickOutside,
      },
    });
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
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
          {/* positioning */}
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
                        setClickOutside={handleClickOutside}
                        clickOutside={!!clickOutside}
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
                    <h3 className="text-sm font-semibold text-slate-700">Overwrite border highlight</h3>
                    <p className="text-xs font-normal text-slate-500">
                      Change the border highlight for this survey.
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
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
