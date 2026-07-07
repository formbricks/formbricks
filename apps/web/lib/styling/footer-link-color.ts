import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { getContrastRatio, mixColor } from "@/lib/utils/colors";

// Subtle-but-compliant palette — keeps the muted look of the old slate-500 footer while
// clearing WCAG AA. Dark tone for light surfaces, light tone for dark surfaces.
const SUBTLE_DARK = "#334155"; // slate-700
const SUBTLE_LIGHT = "#f1f5f9"; // slate-100
// Maximum-contrast fallback for mid-tone surfaces where neither subtle tone reaches AA.
const STRONG_DARK = "#0f172a"; // slate-900
const STRONG_LIGHT = "#ffffff";

// Backdrop rendered behind the footer links when the background is not a solid color
// (image/animation/upload), so the links always contrast against a known light surface.
export const FOOTER_MEDIA_BACKDROP = "rgba(255, 255, 255, 0.9)";
// Opaque color used to evaluate contrast against that (mostly-opaque white) backdrop.
const FOOTER_MEDIA_SURFACE = "#ffffff";

const AA_CONTRAST = 4.5;

type Styling = TSurveyStyling | TWorkspaceStyling;

export interface FooterLinkStyle {
  /** Text color for the footer links, guaranteed >= 4.5:1 against the resolved surface. */
  textColor: string;
  /** Set only for non-solid backgrounds: a near-white surface to render behind the links. */
  backdropColor?: string;
}

// Approximate the CSS `filter: brightness(x%)` applied to the background so the contrast
// calculation reflects what the viewer actually sees.
const applyBrightness = (hex: string, brightness: number): string => {
  if (brightness === 100) return hex;
  const amount = Math.min(Math.abs(brightness - 100), 100) / 100;
  return mixColor(hex, brightness < 100 ? "#000000" : "#ffffff", amount);
};

// Pick a footer text color that clears WCAG AA against the given opaque surface. Prefer the
// subtle slate tones; escalate to pure black/white only for mid-tone surfaces where neither
// subtle tone reaches 4.5:1 (the worst case across all colors is ~4.58:1, so this always passes).
const pickAccessibleTextColor = (surface: string): string => {
  const subtle =
    getContrastRatio(SUBTLE_DARK, surface) >= getContrastRatio(SUBTLE_LIGHT, surface)
      ? SUBTLE_DARK
      : SUBTLE_LIGHT;
  if (getContrastRatio(subtle, surface) >= AA_CONTRAST) return subtle;

  return getContrastRatio(STRONG_DARK, surface) >= getContrastRatio(STRONG_LIGHT, surface)
    ? STRONG_DARK
    : STRONG_LIGHT;
};

/**
 * Computes the accessible footer-link color (and optional backdrop) for a survey's styling.
 *
 * - Solid-color background: the text color contrasts with that brightness-adjusted color.
 * - Image / animation / upload background (or none): the links sit on a near-white backdrop
 *   and use a dark text color, guaranteeing contrast against a known surface.
 *
 * This is the *auto* value; an explicit `styling.linkColor` set by the user overrides it at
 * the call site.
 */
export const getFooterLinkStyle = (styling: Styling): FooterLinkStyle => {
  const background = styling.background;

  if (background?.bgType === "color" && background.bg) {
    const surface = applyBrightness(background.bg, background.brightness ?? 100);
    return { textColor: pickAccessibleTextColor(surface) };
  }

  return {
    textColor: pickAccessibleTextColor(FOOTER_MEDIA_SURFACE),
    backdropColor: FOOTER_MEDIA_BACKDROP,
  };
};
