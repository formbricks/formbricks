"use client";

import { Placement } from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/editLookAndFeel";
import { PlacementType } from "@formbricks/types/js";
import type { Survey } from "@formbricks/types/surveys";
import { ColorPicker, Label, Switch } from "@formbricks/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

interface StylingCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}

export default function StylingCard({ localSurvey, setLocalSurvey }: StylingCardProps) {
  const [open, setOpen] = useState(false);

  const {
    brandColor,
    placement,
    darkOverlay,
    clickOutsideClose,
    type,
    highlightBorderColor,
    overwriteBorderHighlight,
  } = localSurvey;

  const isBrandColor = brandColor !== null;
  const ishighlightBorder = highlightBorderColor !== null;
  const isPosition = placement !== null;

  const togglePlacement = () => {
    if (isPosition) {
      const updatedSurvey: Survey = {
        ...localSurvey,
        placement: null,
        clickOutsideClose: true,
        darkOverlay: false,
      };
      setLocalSurvey(updatedSurvey);
    } else {
      const updatedSurvey: Survey = { ...localSurvey, placement: "bottomRight" };
      setLocalSurvey(updatedSurvey);
    }
  };

  const toggleBrandColor = () => {
    if (isBrandColor) {
      setLocalSurvey({ ...localSurvey, brandColor: null });
    } else {
      setLocalSurvey({ ...localSurvey, brandColor: "#64748b" });
    }
  };

  const toggleBorderColor = () => {
    if (ishighlightBorder) {
      setLocalSurvey({ ...localSurvey, highlightBorderColor: null });
    } else {
      setLocalSurvey({ ...localSurvey, highlightBorderColor: "#64748b" });
    }
  };

  const toggleBorderColorSetting = () => {
    if (overwriteBorderHighlight) {
      setLocalSurvey({ ...localSurvey, overwriteBorderHighlight: false });
    } else {
      setLocalSurvey({ ...localSurvey, overwriteBorderHighlight: true });
    }
  };

  const handleColorChange = (color: string) => {
    setLocalSurvey({ ...localSurvey, brandColor: color });
  };

  const handleBorderColorChange = (color: string) => {
    setLocalSurvey({ ...localSurvey, highlightBorderColor: color });
  };

  const handlePlacementChange = (placement: PlacementType) => {
    setLocalSurvey({ ...localSurvey, placement });
  };

  const handleOverlay = (overlay: string) => {
    const darkOverlay = overlay === "darkOverlay";
    setLocalSurvey({ ...localSurvey, darkOverlay });
  };

  const handlClickOutside = (isClickOutside: string) => {
    const clickOutsideClose = isClickOutside === "allow";
    setLocalSurvey({ ...localSurvey, clickOutsideClose });
  };

  const overlay = darkOverlay === null ? "" : darkOverlay ? "darkOverlay" : "lightOverlay";

  const clickOutside = clickOutsideClose === null ? "" : clickOutsideClose ? "allow" : "disallow";

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
              <Switch id="autoComplete" checked={isBrandColor} onCheckedChange={toggleBrandColor} />
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
                <Switch id="surveyDeadline" checked={isPosition} onCheckedChange={togglePlacement} />
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
                        overlay={overlay}
                        setClickOutside={handlClickOutside}
                        clickOutside={clickOutside}
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
                  checked={overwriteBorderHighlight}
                  onCheckedChange={toggleBorderColorSetting}
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
              {overwriteBorderHighlight && (
                <div className="ml-2 mt-4 rounded-lg border bg-slate-50 p-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="highlightBorder"
                      checked={ishighlightBorder}
                      onCheckedChange={toggleBorderColor}
                    />
                    <h2 className="text-sm font-medium text-slate-800">Show highlight border</h2>
                  </div>
                  {ishighlightBorder && (
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
