"use client";

import { cn } from "@formbricks/lib/cn";
import { Label, RadioGroup, RadioGroupItem } from "@formbricks/ui";
import { getPlacementStyle } from "@/lib/preview";
import { PlacementType } from "@formbricks/types/js";
const placements = [
  { name: "Bottom Right", value: "bottomRight", disabled: false },
  { name: "Top Right", value: "topRight", disabled: false },
  { name: "Top Left", value: "topLeft", disabled: false },
  { name: "Bottom Left", value: "bottomLeft", disabled: false },
  { name: "Centered Modal", value: "center", disabled: false },
];

type TPlacementProps = {
  currentPlacement: PlacementType;
  setCurrentPlacement: (placement: PlacementType) => void;
  setOverlay: (overlay: string) => void;
  overlay: string;
  setClickOutside: (clickOutside: boolean) => void;
  clickOutside: boolean;
};

export default function Placement({
  setCurrentPlacement,
  currentPlacement,
  setOverlay,
  overlay,
  setClickOutside,
  clickOutside,
}: TPlacementProps) {
  return (
    <>
      <div className="flex">
        <RadioGroup onValueChange={(e) => setCurrentPlacement(e as PlacementType)} value={currentPlacement}>
          {placements.map((placement) => (
            <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
              <RadioGroupItem id={placement.value} value={placement.value} disabled={placement.disabled} />
              <Label
                htmlFor={placement.value}
                className={cn(placement.disabled ? "cursor-not-allowed text-slate-500" : "text-slate-900")}>
                {placement.name}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
          <div
            className={cn(
              "absolute h-16 w-16 rounded bg-slate-700",
              getPlacementStyle(currentPlacement)
            )}></div>
        </div>
      </div>
      {currentPlacement === "center" && (
        <>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">Centered modal overlay color</Label>
            <RadioGroup
              onValueChange={(overlay) => setOverlay(overlay)}
              value={overlay}
              className="flex space-x-4">
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="lightOverlay" value="light" />
                <Label htmlFor="lightOverlay" className="text-slate-900">
                  Light Overlay
                </Label>
              </div>
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="darkOverlay" value="dark" />
                <Label htmlFor="darkOverlay" className="text-slate-900">
                  Dark Overlay
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">Allow users to exit by clicking outside the study</Label>
            <RadioGroup
              onValueChange={(value) => setClickOutside(value === "allow")}
              value={clickOutside ? "allow" : "disallow"}
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
    </>
  );
}
