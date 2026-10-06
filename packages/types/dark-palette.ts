// Dark-mode palette derivation, shared by the survey renderer (packages/surveys), the editor
// preview and the editor contrast warnings (apps/web). Lives next to colors.ts for the same
// reason: @formbricks/types is the only dependency both sides share.
//
// Rules (ENG-3451 / M2.05):
// - Derive by role from the brand color, not color by color: flipping each light value does not
//   work (the default headline color on a dark card is 1.38 : 1).
// - Colors the creator types as part of their brand (brand, button, progress indicator) keep
//   their light value in dark (D12). The editor warns instead of changing them.
// - Only explicit dark overrides are stored. `dark: null` means "derived", so derived values
//   follow the light brand color and are never persisted.
import { ensureReadable, getContrastRatio, mixColor, normalizeHex } from "./colors";
import { type TBaseStyling, type TStylingColor } from "./styling";

export const DEFAULT_DARK_BRAND_COLOR = "#1e40af";

// Near-black base the dark surfaces are tinted from.
export const DARK_BASE_COLOR = "#0b0f17";

// WCAG 2.x thresholds: 4.5 for text, 3 for non-text UI (borders, indicators, focus).
const TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;

export type TStylingColorKey = {
  [K in keyof TBaseStyling]-?: NonNullable<TBaseStyling[K]> extends TStylingColor ? K : never;
}[keyof TBaseStyling];

export type TDarkColors = Record<TStylingColorKey, string>;

// The color fields that are part of the creator's brand. They are not derived in dark: an unset
// dark value falls back to the light value (D12).
export const BRAND_PRESERVED_COLOR_KEYS = [
  "brandColor",
  "buttonBgColor",
  "buttonTextColor",
  "progressIndicatorBgColor",
] as const satisfies readonly TStylingColorKey[];

/**
 * Derives the full dark palette for a brand color. Every derived text color clears 4.5 : 1 and
 * every derived border / track clears 3 : 1 against the surface it sits on.
 */
export const getDerivedDarkColors = (brandColor: string = DEFAULT_DARK_BRAND_COLOR): TDarkColors => {
  const cardBg = mixColor(brandColor, DARK_BASE_COLOR, 0.9);
  // Inputs and options are the lightest dark surface; hover/selected lighten them a little more.
  const inputBg = mixColor(brandColor, DARK_BASE_COLOR, 0.82);
  const lightestSurface = mixColor(inputBg, "#ffffff", 0.08);

  const text = ensureReadable(mixColor(brandColor, "#ffffff", 0.85), lightestSurface, TEXT_CONTRAST);
  const inputBorder = ensureReadable(mixColor(brandColor, DARK_BASE_COLOR, 0.45), cardBg, NON_TEXT_CONTRAST);
  const progressTrack = ensureReadable(mixColor(brandColor, DARK_BASE_COLOR, 0.6), cardBg, NON_TEXT_CONTRAST);

  return {
    brandColor,
    buttonBgColor: brandColor,
    buttonTextColor:
      getContrastRatio("#ffffff", brandColor) >= getContrastRatio("#0f172a", brandColor)
        ? "#ffffff"
        : "#0f172a",
    progressIndicatorBgColor: brandColor,

    cardBackgroundColor: cardBg,
    cardBorderColor: mixColor(brandColor, DARK_BASE_COLOR, 0.7),
    highlightBorderColor: ensureReadable(brandColor, cardBg, NON_TEXT_CONTRAST),

    inputBgColor: inputBg,
    inputBorderColor: inputBorder,
    inputTextColor: text,
    optionBgColor: inputBg,
    optionBorderColor: inputBorder,
    optionLabelColor: text,

    elementHeadlineColor: text,
    elementDescriptionColor: text,
    elementUpperLabelColor: text,
    footerLinkColor: text,

    accentBgColor: mixColor(brandColor, DARK_BASE_COLOR, 0.72),
    accentBgColorSelected: mixColor(brandColor, DARK_BASE_COLOR, 0.62),

    progressTrackBgColor: progressTrack,
  };
};

/**
 * Color fields with one value for both appearances. The brand color identifies the brand, so it is
 * never edited per appearance and a stored `.dark` is ignored: the editor shows one brand picker and
 * the preview always matches it. Button and progress colors stay overridable.
 */
export const SHARED_COLOR_KEYS = ["brandColor"] as const satisfies readonly TStylingColorKey[];

const BRAND_PRESERVED = new Set<TStylingColorKey>(BRAND_PRESERVED_COLOR_KEYS);
const SHARED = new Set<TStylingColorKey>(SHARED_COLOR_KEYS);

// Styling reaches the renderer from the API and MCP too, so a stored value can be anything. An
// unparseable one is treated as unset: the color math downstream throws on it, and one bad dark
// value must not take the whole survey down.
const validColor = (color: string | null | undefined): string | undefined =>
  color && normalizeHex(color) ? color : undefined;

/**
 * Resolves every color field for dark mode: explicit dark override → light value for brand
 * colors (D12) → derived value. `undefined` only for a brand color with no light value either,
 * so the caller can leave the CSS default in place exactly as it does in light mode.
 */
export const resolveDarkColors = (
  styling: Partial<Record<TStylingColorKey, TStylingColor | null | undefined>>
): Record<TStylingColorKey, string | undefined> => {
  const derived = getDerivedDarkColors(validColor(styling.brandColor?.light) ?? DEFAULT_DARK_BRAND_COLOR);

  return Object.fromEntries(
    (Object.keys(derived) as TStylingColorKey[]).map((key) => {
      const color = styling[key];
      const darkValue = SHARED.has(key) ? undefined : validColor(color?.dark);
      if (darkValue) return [key, darkValue];
      if (BRAND_PRESERVED.has(key)) return [key, validColor(color?.light)];
      return [key, derived[key]];
    })
  ) as Record<TStylingColorKey, string | undefined>;
};

// The light error color (survey-ui `--destructive`, Tailwind red-600).
const LIGHT_ERROR_COLOR = "#e7000b";

/**
 * Colors that must stay readable on the dark card whatever the brand is. The brand itself is
 * preserved for fills (D12), but brand-colored text and the focus ring are lightened just enough
 * to clear WCAG, and the error red likewise.
 */
export const getDarkReadableColors = (brandColor: string, cardColor: string) => ({
  brandTextColor: ensureReadable(brandColor, cardColor, TEXT_CONTRAST),
  focusRingColor: ensureReadable(brandColor, cardColor, NON_TEXT_CONTRAST),
  errorColor: ensureReadable(LIGHT_ERROR_COLOR, cardColor, TEXT_CONTRAST),
});

export type TDarkContrastWarning = {
  key: "brandColor" | "buttonBgColor" | "buttonTextColor" | "progressIndicatorBgColor";
  ratio: number;
  minimum: number;
};

/**
 * Brand colors stay as typed in dark (D12), so they can be hard to see. Returns one warning per
 * color below WCAG non-text contrast on the dark card, plus button text against the button
 * itself (a preserved color does not mean an accessible one).
 */
export const getDarkContrastWarnings = (
  styling: Partial<Record<TStylingColorKey, TStylingColor | null | undefined>>
): TDarkContrastWarning[] => {
  const resolved = resolveDarkColors(styling);
  const card = resolved.cardBackgroundColor ?? getDerivedDarkColors().cardBackgroundColor;
  const warnings: TDarkContrastWarning[] = [];

  for (const key of ["brandColor", "buttonBgColor", "progressIndicatorBgColor"] as const) {
    const color = resolved[key];
    if (!color) continue;
    const ratio = getContrastRatio(color, card);
    if (ratio < NON_TEXT_CONTRAST) warnings.push({ key, ratio, minimum: NON_TEXT_CONTRAST });
  }

  const buttonBg = resolved.buttonBgColor ?? resolved.brandColor;
  if (buttonBg && resolved.buttonTextColor) {
    const ratio = getContrastRatio(resolved.buttonTextColor, buttonBg);
    if (ratio < TEXT_CONTRAST) warnings.push({ key: "buttonTextColor", ratio, minimum: TEXT_CONTRAST });
  }

  return warnings;
};
