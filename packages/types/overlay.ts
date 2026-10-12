// Custom overlay colour and opacity for modal (app) surveys. They sit next to the `overlay` enum
// instead of extending it: the iOS SDK (1.2.0–2.2.0) decodes that enum with Codable, so a new value
// would break decoding of the whole environment response. Keep this file to schemas and pure helpers.
import { z } from "zod";
import { hexToRGBA } from "./colors";
import type { TOverlay } from "./common";

// Hex without alpha only, because opacity is its own field.
export const ZOverlayColor = z.string().regex(/^#(?:[A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/);

// Percent. The 10% floor is on purpose: an overlay blocks the page (focus trap, aria-modal, it
// swallows clicks), so an invisible one would leave a page that looks usable but is not.
export const OVERLAY_OPACITY_MIN = 10;
export const OVERLAY_OPACITY_MAX = 100;
export const ZOverlayOpacity = z.int().min(OVERLAY_OPACITY_MIN).max(OVERLAY_OPACITY_MAX);

// null means "use the preset's value".
export const ZOverlayAppearance = z.object({
  color: ZOverlayColor.nullable(),
  opacity: ZOverlayOpacity.nullable(),
});
export type TOverlayAppearance = z.infer<typeof ZOverlayAppearance>;

// Hex approximations of the preset classes (`bg-slate-400/50`, `bg-slate-700/80`; Tailwind 4 defines
// slate in OKLCH). Used to prefill the Custom controls and to fill in a missing half.
export const OVERLAY_PRESETS = {
  light: { color: "#90a1b9", opacity: 50 },
  dark: { color: "#314158", opacity: 80 },
} as const satisfies Record<Exclude<TOverlay, "none">, { color: string; opacity: number }>;

export const getOverlayPreset = (overlay: TOverlay) =>
  overlay === "light" ? OVERLAY_PRESETS.light : OVERLAY_PRESETS.dark;

export interface TResolvedOverlayAppearance {
  overlay: TOverlay;
  color?: string | null;
  opacity?: number | null;
}

interface TOverlaySource {
  overlay?: TOverlay | null;
  overlayColor?: string | null;
  overlayOpacity?: number | null;
}

// Stored values are validated on write, but they reach the renderer as raw JSON. Anything that does
// not parse is treated as unset, so a bad value falls back to the preset instead of painting nothing.
const toOverlayColor = (value: unknown): string | null => {
  const parsed = ZOverlayColor.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const toOverlayOpacity = (value: unknown): number | null => {
  const parsed = ZOverlayOpacity.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/**
 * Resolves the overlay as one unit: when the survey overrides `overlay`, its colour and opacity come
 * from the survey too (null there means preset, never the workspace's custom values). Otherwise all
 * three come from the workspace. Matches how every SDK resolves the enum
 * (`overwrites.overlay ?? settings.overlay`).
 */
export const resolveOverlayAppearance = (
  surveyOverwrites: TOverlaySource | null | undefined,
  workspace: TOverlaySource
): Required<TResolvedOverlayAppearance> => {
  const source = surveyOverwrites?.overlay == null ? workspace : surveyOverwrites;

  return {
    overlay: source.overlay ?? "none",
    color: toOverlayColor(source.overlayColor),
    opacity: toOverlayOpacity(source.overlayOpacity),
  };
};

// The one "is custom" rule, shared by the environment payload, the editor tabs and every preview.
export const isCustomOverlay = ({ overlay, color, opacity }: TResolvedOverlayAppearance): boolean =>
  (overlay === "light" || overlay === "dark") &&
  (toOverlayColor(color) !== null || toOverlayOpacity(opacity) !== null);

// Undefined means "keep the preset class". Returns `rgba()`, never `color-mix()`, which older iOS
// webviews do not support.
export const getOverlayBackground = (appearance: TResolvedOverlayAppearance): string | undefined => {
  if (!isCustomOverlay(appearance)) return undefined;

  const preset = getOverlayPreset(appearance.overlay);
  return hexToRGBA(
    toOverlayColor(appearance.color) ?? preset.color,
    (toOverlayOpacity(appearance.opacity) ?? preset.opacity) / 100
  );
};
