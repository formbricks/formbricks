"use client";

import { useTranslations } from "next-intl";
import { cn } from "@formbricks/lib/cn";
import { TPlacement } from "@formbricks/types/common";
import { Label } from "@formbricks/ui/components/Label";
import { getPlacementStyle } from "@formbricks/ui/components/PreviewSurvey/lib/utils";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/components/RadioGroup";

const placements = [
  { name: "common.bottom_right", value: "bottomRight", disabled: false },
  { name: "common.top_right", value: "topRight", disabled: false },
  { name: "common.top_left", value: "topLeft", disabled: false },
  { name: "common.bottom_left", value: "bottomLeft", disabled: false },
  { name: "common.centered_modal", value: "center", disabled: false },
];

interface TPlacementProps {
  currentPlacement: TPlacement;
  setCurrentPlacement: (placement: TPlacement) => void;
  setOverlay: (overlay: string) => void;
  overlay: string;
  setClickOutsideClose: (clickOutside: boolean) => void;
  clickOutsideClose: boolean;
}

export const Placement = ({
  setCurrentPlacement,
  currentPlacement,
  setOverlay,
  overlay,
  setClickOutsideClose,
  clickOutsideClose,
}: TPlacementProps) => {
  const t = useTranslations();
  const overlayStyle =
    currentPlacement === "center" && overlay === "dark" ? "bg-gray-700/80" : "bg-slate-200";
  return (
    <>
      <div className="flex">
        <RadioGroup onValueChange={(e) => setCurrentPlacement(e as TPlacement)} value={currentPlacement}>
          {placements.map((placement) => (
            <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
              <RadioGroupItem id={placement.value} value={placement.value} disabled={placement.disabled} />
              <Label htmlFor={placement.value} className="text-slate-900">
                {t(placement.name)}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div
          className={cn(
            clickOutsideClose ? "" : "cursor-not-allowed",
            "relative ml-8 h-40 w-full rounded",
            overlayStyle
          )}>
          <div
            className={cn(
              "absolute h-16 w-16 cursor-default rounded bg-slate-700",
              getPlacementStyle(currentPlacement)
            )}></div>
        </div>
      </div>
      {currentPlacement === "center" && (
        <>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">
              {t("environments.surveys.edit.centered_modal_overlay_color")}
            </Label>
            <RadioGroup
              onValueChange={(overlay) => setOverlay(overlay)}
              value={overlay}
              className="flex space-x-4">
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="lightOverlay" value="light" />
                <Label htmlFor="lightOverlay" className="text-slate-900">
                  {t("common.light_overlay")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="darkOverlay" value="dark" />
                <Label htmlFor="darkOverlay" className="text-slate-900">
                  {t("common.dark_overlay")}
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="mt-6 space-y-2">
            <Label className="font-semibold">
              {t("common.allow_users_to_exit_by_clicking_outside_the_survey")}
            </Label>
            <RadioGroup
              onValueChange={(value) => setClickOutsideClose(value === "allow")}
              value={clickOutsideClose ? "allow" : "disallow"}
              className="flex space-x-4">
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="disallow" value="disallow" />
                <Label htmlFor="disallow" className="text-slate-900">
                  {t("common.disallow")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 whitespace-nowrap">
                <RadioGroupItem id="allow" value="allow" />
                <Label htmlFor="allow" className="text-slate-900">
                  {t("common.allow")}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </>
      )}
    </>
  );
};
