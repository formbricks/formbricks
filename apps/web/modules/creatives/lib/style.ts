import type { BannerThemeZodType, FeedbackButtonThemeZodType } from "@formbricks/api-v3-schemas";
import type {
  TCreativeColors,
  TCreativeCustomCss,
  TCreativeElementStyle,
  TCreativeStyle,
} from "@formbricks/creatives";
import { getContrastRatio, normalizeHex } from "@formbricks/types/colors";
import type { TCustomCssInput } from "@formbricks/types/custom-css";
import { resolveDarkColors } from "@formbricks/types/dark-palette";
import type { TBaseStyling, TStylingColor } from "@formbricks/types/styling";
import { sanitizeThemeStyling } from "@formbricks/types/styling-values";
import { STYLE_DEFAULTS } from "@/lib/styling/constants";

/**
 * A creative's look (ENG-3998, ENG-3580, ENG-3865): computed here, on the server for the environment
 * payload and in the editor for the live preview, and only applied by `@formbricks/creatives`' `render`.
 *
 * - Defaults come from the workspace Look & Feel, never from the linked survey's own styling: a feedback
 *   button looks like the survey's Next button, a banner like the survey card with the survey button
 *   inside. A token the workspace never set falls back to `STYLE_DEFAULTS`, which is also what the Look &
 *   Feel page shows for it and what the survey renderer's CSS defaults are.
 * - Dark follows the survey's dark palette (`resolveDarkColors`): explicit dark values, then the brand
 *   colours kept as typed, then values derived from the brand.
 * - "Add custom styles" (`theme.customStyles`) overrides the workspace value field by field. A colour set
 *   there applies in both appearances; when the background or text colour is set, both keep their light
 *   values in dark so their contrast holds; a background set without a text colour gets readable text.
 * - Phone values apply below 768 px; a phone value left empty uses the desktop one.
 */

/** The workspace's Look & Feel as stored (`Workspace.styling`); only the survey theme tokens are read. */
export type TWorkspaceStylingInput = TBaseStyling & { allowStyleOverwrite?: boolean | null };

/** A creative's type and custom styles: a stored creative, or the editor's unsaved form. */
export type TCreativeStyleSource =
  | { type: "feedbackButton"; styling: { theme: FeedbackButtonThemeZodType } }
  | { type: "banner"; styling: { theme: BannerThemeZodType } };

/** The text colours the survey picks for a button colour without one (survey renderer, dark palette). */
const DARK_TEXT = "#0f172a";
const LIGHT_TEXT = "#ffffff";

/** A banner's bar has no survey token for its padding; these fit one line of card text. */
const BANNER_PADDING = { paddingX: 16, paddingY: 12 } as const;

const readableTextOn = (background: string): string =>
  getContrastRatio(DARK_TEXT, background) >= getContrastRatio(LIGHT_TEXT, background)
    ? DARK_TEXT
    : LIGHT_TEXT;

const toHex = (color: string | null | undefined): string | undefined =>
  color ? normalizeHex(color) : undefined;

const lightOf = (color: TStylingColor | null | undefined): string | undefined => toHex(color?.light);

/** A stored dimension in px (`12`, `"12"`, `"12px"`), or `fallback` for anything else (`"auto"`, rem…). */
const toPx = (value: number | string | null | undefined, fallback: number): number => {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : fallback;
  const match = typeof value === "string" ? /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/.exec(value) : null;
  return match ? Number(match[1]) : fallback;
};

const FONT_WEIGHT_KEYWORDS: Record<string, number> = { normal: 400, bold: 700 };

const toFontWeight = (value: number | string | null | undefined, fallback: number): number => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return fallback;
  return FONT_WEIGHT_KEYWORDS[value.trim()] ?? toPx(value, fallback);
};

/** `STYLE_DEFAULTS` as plain values, so a workspace without a token gets what the Look & Feel shows. */
const DEFAULT_BUTTON_BG = lightOf(STYLE_DEFAULTS.buttonBgColor) ?? "#1e40af";
const DEFAULT_BUTTON_TEXT = lightOf(STYLE_DEFAULTS.buttonTextColor) ?? LIGHT_TEXT;

/** The survey's Next button in this workspace's Look & Feel, light and dark. */
const getSurveyButtonStyle = (
  workspace: TBaseStyling,
  dark: ReturnType<typeof resolveDarkColors>
): TCreativeElementStyle => {
  const savedBackground = lightOf(workspace.buttonBgColor);
  const background = savedBackground ?? DEFAULT_BUTTON_BG;
  const text =
    lightOf(workspace.buttonTextColor) ??
    (savedBackground ? readableTextOn(background) : DEFAULT_BUTTON_TEXT);

  // Button colours keep their light value in dark unless the workspace set a dark one (D12).
  const darkBackground = toHex(dark.buttonBgColor) ?? background;
  const darkText = toHex(dark.buttonTextColor) ?? (savedBackground ? readableTextOn(darkBackground) : text);

  const size = {
    fontSize: toPx(workspace.buttonFontSize, toPx(STYLE_DEFAULTS.buttonFontSize, 16)),
    paddingX: toPx(workspace.buttonPaddingX, toPx(STYLE_DEFAULTS.buttonPaddingX, 12)),
    paddingY: toPx(workspace.buttonPaddingY, toPx(STYLE_DEFAULTS.buttonPaddingY, 12)),
  };

  return {
    light: { backgroundColor: background, textColor: text, borderColor: null },
    dark: { backgroundColor: darkBackground, textColor: darkText, borderColor: null },
    desktop: size,
    phone: size,
    // The survey renderer applies the card roundness to buttons, then a button radius over it.
    borderRadius: toPx(
      workspace.buttonBorderRadius,
      toPx(workspace.roundness, toPx(STYLE_DEFAULTS.buttonBorderRadius, 8))
    ),
    fontWeight: toFontWeight(workspace.buttonFontWeight, toFontWeight(STYLE_DEFAULTS.buttonFontWeight, 500)),
  };
};

/** The survey card in this workspace's Look & Feel, light and dark: the banner's bar. */
const getSurveyCardStyle = (
  workspace: TBaseStyling,
  dark: ReturnType<typeof resolveDarkColors>
): TCreativeElementStyle => {
  const light: TCreativeColors = {
    backgroundColor:
      lightOf(workspace.cardBackgroundColor) ?? lightOf(STYLE_DEFAULTS.cardBackgroundColor) ?? LIGHT_TEXT,
    textColor:
      lightOf(workspace.elementHeadlineColor) ?? lightOf(STYLE_DEFAULTS.elementHeadlineColor) ?? DARK_TEXT,
    borderColor: lightOf(workspace.cardBorderColor) ?? lightOf(STYLE_DEFAULTS.cardBorderColor) ?? null,
  };
  const size = {
    fontSize: toPx(workspace.elementHeadlineFontSize, toPx(STYLE_DEFAULTS.elementHeadlineFontSize, 16)),
    ...BANNER_PADDING,
  };

  return {
    light,
    dark: {
      backgroundColor: toHex(dark.cardBackgroundColor) ?? light.backgroundColor,
      textColor: toHex(dark.elementHeadlineColor) ?? light.textColor,
      borderColor: toHex(dark.cardBorderColor) ?? light.borderColor,
    },
    desktop: size,
    phone: size,
    // A bar spans the page edge to edge; only buttons have a radius to set.
    borderRadius: 0,
    fontWeight: toFontWeight(
      workspace.elementHeadlineFontWeight,
      toFontWeight(STYLE_DEFAULTS.elementHeadlineFontWeight, 500)
    ),
  };
};

/** The workspace look with the creative's custom styles over it. */
const applyCustomStyles = (
  base: TCreativeElementStyle,
  source: TCreativeStyleSource
): TCreativeElementStyle => {
  const { theme } = source.styling;
  if (!theme.customStyles) return base;

  const textColor =
    theme.textColor ?? (theme.backgroundColor ? readableTextOn(theme.backgroundColor) : base.light.textColor);
  const light: TCreativeColors = {
    backgroundColor: theme.backgroundColor ?? base.light.backgroundColor,
    textColor,
    borderColor: theme.borderColor ?? base.light.borderColor,
  };
  const keepsLightPair = theme.backgroundColor !== null || theme.textColor !== null;
  const desktop = {
    fontSize: theme.fontSize.desktop ?? base.desktop.fontSize,
    paddingX: theme.paddingX.desktop ?? base.desktop.paddingX,
    paddingY: theme.paddingY.desktop ?? base.desktop.paddingY,
  };

  return {
    light,
    dark: {
      backgroundColor: keepsLightPair ? light.backgroundColor : base.dark.backgroundColor,
      textColor: keepsLightPair ? light.textColor : base.dark.textColor,
      borderColor: theme.borderColor ?? base.dark.borderColor,
    },
    desktop,
    phone: {
      fontSize: theme.fontSize.phone ?? desktop.fontSize,
      paddingX: theme.paddingX.phone ?? desktop.paddingX,
      paddingY: theme.paddingY.phone ?? desktop.paddingY,
    },
    borderRadius:
      source.type === "feedbackButton"
        ? (source.styling.theme.borderRadius ?? base.borderRadius)
        : base.borderRadius,
    fontWeight: theme.fontWeight ?? base.fontWeight,
  };
};

/**
 * The Custom CSS source that applies to a creative: its own, only while its custom styles are on (like a
 * survey's CSS, which applies only while the survey's style overrides do). `null` when there is none.
 */
export const getAppliedCustomCssSource = (
  theme: FeedbackButtonThemeZodType | BannerThemeZodType
): TCustomCssInput | null => {
  if (!theme.customStyles || !theme.customCss) return null;
  const { light, dark } = theme.customCss;
  return light?.trim() || dark?.trim() ? theme.customCss : null;
};

/**
 * Everything `render` needs to draw a creative. `workspaceStyling` is the workspace's stored Look & Feel;
 * `customCss` is the creative's CSS as the processor compiled it (server only; the editor preview
 * compiles it through the custom CSS validation endpoint).
 */
export const getCreativeStyle = (
  source: TCreativeStyleSource,
  workspaceStyling: TWorkspaceStylingInput | null | undefined,
  customCss: TCreativeCustomCss | null = null
): TCreativeStyle => {
  // Stored styling can predate write-time validation: an unsafe value counts as unset (ENG-2950).
  const workspace = sanitizeThemeStyling(workspaceStyling ?? {});
  const dark = resolveDarkColors(workspace);
  const surveyButton = getSurveyButtonStyle(workspace, dark);
  const base = source.type === "feedbackButton" ? surveyButton : getSurveyCardStyle(workspace, dark);
  const { theme } = source.styling;
  const ownPageFont = theme.customStyles ? theme.pageFont : null;

  return {
    element: applyCustomStyles(base, source),
    button: source.type === "banner" ? surveyButton : null,
    pageFont: typeof ownPageFont === "boolean" ? ownPageFont : workspace.pageFont === true,
    customCss: theme.customStyles ? customCss : null,
  };
};
