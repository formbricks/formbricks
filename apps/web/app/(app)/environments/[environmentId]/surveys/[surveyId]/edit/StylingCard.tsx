"use client";

import { getPlacementStyle } from "@/lib/preview";
import { cn } from "@formbricks/lib/cn";
import { PlacementType } from "@formbricks/types/js";
import type { Survey } from "@formbricks/types/surveys";
import { ColorPicker, Label, RadioGroup, RadioGroupItem, Switch } from "@formbricks/ui";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";

interface StylingCardProps {
  localSurvey: Survey;
  setLocalSurvey: (survey: Survey) => void;
}

export default function StylingCard({ localSurvey, setLocalSurvey }: StylingCardProps) {
  const [open, setOpen] = useState(false);
  const isBrandColor = localSurvey.brandColor !== null;
  const isPosition = localSurvey.placement !== null;
  console.log(localSurvey);

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

  const handleColorChange = (color: string) => {
    setLocalSurvey({ ...localSurvey, brandColor: color });
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

  const placements = [
    { name: "Bottom Right", value: "bottomRight", disabled: false },
    { name: "Top Right", value: "topRight", disabled: false },
    { name: "Top Left", value: "topLeft", disabled: false },
    { name: "Bottom Left", value: "bottomLeft", disabled: false },
    { name: "Centered Modal", value: "center", disabled: false },
  ];

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
            {localSurvey.brandColor && (
              <div className="ml-2 mt-4 rounded-lg border bg-slate-50 p-4">
                <div className="w-full max-w-xs">
                  <Label htmlFor="brandcolor">Color (HEX)</Label>
                  <ColorPicker color={localSurvey.brandColor} onChange={handleColorChange} />
                </div>
              </div>
            )}
          </div>
          {/* positioning */}
          {localSurvey.type !== "link" && (
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
              {localSurvey.placement && (
                <div className="ml-2 mt-4 flex items-center space-x-1 pb-4">
                  <div className="flex w-full cursor-pointer items-center rounded-lg  border bg-slate-50 p-4">
                    <div className="w-full items-center">
                      <div className="flex">
                        <RadioGroup
                          onValueChange={(e) => handlePlacementChange(e as PlacementType)}
                          value={localSurvey.placement}>
                          {placements.map((placement) => (
                            <div
                              key={placement.value}
                              className="flex items-center space-x-2 whitespace-nowrap">
                              <RadioGroupItem
                                id={placement.value}
                                value={placement.value}
                                disabled={placement.disabled}
                              />
                              <Label
                                htmlFor={placement.value}
                                className={cn(
                                  placement.disabled ? "cursor-not-allowed text-slate-500" : "text-slate-900"
                                )}>
                                {placement.name}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
                          <div
                            className={cn(
                              "absolute h-16 w-16 rounded bg-slate-700",
                              getPlacementStyle(localSurvey.placement)
                            )}></div>
                        </div>
                      </div>

                      {localSurvey.placement === "center" && (
                        <>
                          <div className="mt-6 space-y-2">
                            <Label className="font-semibold">Centered modal overlay color</Label>
                            <RadioGroup
                              onValueChange={(e) => handleOverlay(e)}
                              value={
                                localSurvey.darkOverlay === null
                                  ? ""
                                  : localSurvey.darkOverlay
                                  ? "darkOverlay"
                                  : "lightOverlay"
                              }
                              className="flex space-x-4">
                              <div className="flex items-center space-x-2 whitespace-nowrap">
                                <RadioGroupItem id="lightOverlay" value="lightOverlay" />
                                <Label htmlFor="lightOverlay" className="text-slate-900">
                                  Light Overlay
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 whitespace-nowrap">
                                <RadioGroupItem id="darkOverlay" value="darkOverlay" />
                                <Label htmlFor="darkOverlay" className="text-slate-900">
                                  Dark Overlay
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                          <div className="mt-6 space-y-2">
                            <Label className="font-semibold">
                              Allow users to exit by clicking outside the study
                            </Label>
                            <RadioGroup
                              onValueChange={(e) => handlClickOutside(e)}
                              value={
                                localSurvey.clickOutsideClose === null
                                  ? ""
                                  : localSurvey.clickOutsideClose
                                  ? "allow"
                                  : "disallow"
                              }
                              className="flex space-x-4">
                              <div className="flex items-center space-x-2 whitespace-nowrap">
                                <RadioGroupItem id="disallow" value="disallow" />
                                <Label htmlFor="disallow" className="text-slate-900">
                                  Don&apos;t Allow
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 whitespace-nowrap">
                                <RadioGroupItem id="allow" value="allow" />
                                <Label htmlFor="allow" className="text-slate-900">
                                  Allow
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}
