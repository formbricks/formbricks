"use client";

import { useTranslation } from "react-i18next";
import { OVERLAY_OPACITY_MAX, OVERLAY_OPACITY_MIN } from "@formbricks/types/overlay";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { Label } from "@/modules/ui/components/label";
import {
  TOverlaySettingsValue,
  TOverlayTab,
  applyOverlayTab,
  getCustomOverlayControlValues,
  getOverlayTab,
} from "@/modules/ui/components/overlay-settings/lib/utils";
import { Slider } from "@/modules/ui/components/slider";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";

interface OverlaySettingsProps extends TOverlaySettingsValue {
  onChange: (value: TOverlaySettingsValue) => void;
  disabled?: boolean;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
}

export const OverlaySettings = ({
  overlay,
  overlayColor,
  overlayOpacity,
  onChange,
  disabled = false,
  activeTabClassName,
  inactiveTabClassName,
}: Readonly<OverlaySettingsProps>) => {
  const { t } = useTranslation();
  const value = { overlay, overlayColor, overlayOpacity };
  const tab = getOverlayTab(value);
  const custom = getCustomOverlayControlValues(value);

  return (
    <div className="space-y-4">
      <StylingTabs<TOverlayTab>
        id="overlay"
        options={[
          { value: "none", label: t("common.no_overlay") },
          { value: "light", label: t("common.light_overlay") },
          { value: "dark", label: t("common.dark_overlay") },
          { value: "custom", label: t("common.custom_overlay") },
        ]}
        defaultSelected={tab}
        onChange={(nextTab) => onChange(applyOverlayTab(nextTab, overlay))}
        label={t("common.overlay")}
        activeTabClassName={activeTabClassName}
        inactiveTabClassName={inactiveTabClassName}
      />

      {tab === "custom" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("common.overlay_color")}</Label>
            <ColorPicker
              color={custom.color}
              onChange={(color) => onChange({ ...value, overlayColor: color })}
              containerClass="w-full"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("common.overlay_opacity")}</Label>
              <span className="text-sm text-slate-500">{custom.opacity}%</span>
            </div>
            <div className="flex h-10 items-center">
              <Slider
                value={[custom.opacity]}
                min={OVERLAY_OPACITY_MIN}
                max={OVERLAY_OPACITY_MAX}
                step={1}
                onValueChange={([opacity]) => onChange({ ...value, overlayOpacity: opacity })}
                disabled={disabled}
                thumbAriaLabel={t("common.overlay_opacity")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
