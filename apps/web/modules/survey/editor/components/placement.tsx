"use client";

import { useTranslation } from "react-i18next";
import { TOverlay, TPlacement } from "@formbricks/types/common";
import { cn } from "@/lib/cn";
import { Label } from "@/modules/ui/components/label";
import { getPlacementStyle } from "@/modules/ui/components/preview-survey/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";

interface TPlacementProps {
  currentPlacement: TPlacement;
  setCurrentPlacement: (placement: TPlacement) => void;
  setOverlay: (overlay: TOverlay) => void;
  overlay: TOverlay;
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
  const { t } = useTranslation();
  const placements = [
    { name: t("common.bottom_right"), value: "bottomRight", disabled: false },
    { name: t("common.top_right"), value: "topRight", disabled: false },
    { name: t("common.top_left"), value: "topLeft", disabled: false },
    { name: t("common.bottom_left"), value: "bottomLeft", disabled: false },
    { name: t("common.centered_modal"), value: "center", disabled: false },
  ];

  const hasOverlay = overlay !== "none";

  const getOverlayStyle = () => {
    if (overlay === "dark") return "bg-slate-700/80";
    if (overlay === "light") return "bg-white/50 border border-slate-200";
    return "bg-slate-200";
  };

  return (
    <>
      <div className="flex">
        <RadioGroup onValueChange={(e) => setCurrentPlacement(e as TPlacement)} value={currentPlacement}>
          {placements.map((placement) => (
            <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
              <RadioGroupItem id={placement.value} value={placement.value} disabled={placement.disabled} />
              <Label htmlFor={placement.value} className="text-slate-900">
                {placement.name}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div
          data-testid="placement-preview"
          className={cn(
            hasOverlay && !clickOutsideClose ? "cursor-not-allowed" : "",
            "relative ml-8 h-40 w-full rounded",
            getOverlayStyle()
          )}>
          <div
            className={cn(
              "absolute h-16 w-16 cursor-default rounded bg-slate-700",
              getPlacementStyle(currentPlacement)
            )}></div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <StylingTabs
          id="overlay"
          options={[
            { value: "none", label: t("common.no_overlay") },
            { value: "light", label: t("common.light_overlay") },
            { value: "dark", label: t("common.dark_overlay") },
          ]}
          defaultSelected={overlay}
          onChange={(value) => setOverlay(value)}
          label={t("common.overlay_color")}
        />
      </div>

      {hasOverlay && (
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
      )}
    </>
  );
};
