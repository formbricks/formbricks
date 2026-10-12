import { TOverlay } from "@formbricks/types/common";
import { getOverlayBackground, getOverlayPreset, isCustomOverlay } from "@formbricks/types/overlay";

// "custom" is a UI-only tab and is never stored: a custom overlay is a light or dark `overlay` plus a
// colour and/or opacity.
export type TOverlayTab = TOverlay | "custom";

export interface TOverlaySettingsValue {
  overlay: TOverlay;
  overlayColor: string | null;
  overlayOpacity: number | null;
}

export const getOverlayTab = ({
  overlay,
  overlayColor,
  overlayOpacity,
}: TOverlaySettingsValue): TOverlayTab =>
  isCustomOverlay({ overlay, color: overlayColor, opacity: overlayOpacity }) ? "custom" : overlay;

/**
 * The values a tab click writes. A preset tab clears the custom values. Custom keeps the current
 * preset as its base ("dark" when there was no overlay) and prefills from it, so the controls start
 * at exactly what the preview already shows.
 */
export const applyOverlayTab = (tab: TOverlayTab, currentOverlay: TOverlay): TOverlaySettingsValue => {
  if (tab !== "custom") return { overlay: tab, overlayColor: null, overlayOpacity: null };

  const overlay = currentOverlay === "none" ? "dark" : currentOverlay;
  const preset = getOverlayPreset(overlay);
  return { overlay, overlayColor: preset.color, overlayOpacity: preset.opacity };
};

// What the Custom controls show. A value saved through the API can have only one half set; the
// other half then renders as the preset, so the controls show that rather than an empty field.
export const getCustomOverlayControlValues = ({
  overlay,
  overlayColor,
  overlayOpacity,
}: TOverlaySettingsValue): { color: string; opacity: number } => {
  const preset = getOverlayPreset(overlay);
  return { color: overlayColor ?? preset.color, opacity: overlayOpacity ?? preset.opacity };
};

// Inline style for a preview backdrop. Undefined means "keep the preset class".
export const getOverlayPreviewStyle = ({
  overlay,
  overlayColor,
  overlayOpacity,
}: TOverlaySettingsValue): { backgroundColor: string } | undefined => {
  const backgroundColor = getOverlayBackground({ overlay, color: overlayColor, opacity: overlayOpacity });
  return backgroundColor ? { backgroundColor } : undefined;
};
