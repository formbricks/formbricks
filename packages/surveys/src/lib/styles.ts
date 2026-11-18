// Add this import for survey-ui CSS variables
import surveyUiCss from "@formbricks/survey-ui/styles?inline";
import {
  DEFAULT_DARK_BRAND_COLOR,
  DEFAULT_INPUT_SHADOW,
  getDarkReadableColors,
  resolveDarkColors,
} from "@formbricks/types/dark-palette";
import { sanitizeThemeStyling } from "@formbricks/types/styling-values";
import { type TSurveyStyling } from "@formbricks/types/surveys/types";
import { type TWorkspaceStyling } from "@formbricks/types/workspace";
import { ensureReadable, isLight, mixColor } from "@/lib/color";
import global from "@/styles/global.css?inline";
import preflight from "@/styles/preflight.css?inline";
import editorCss from "../../../../apps/web/modules/ui/components/editor/styles-editor-frontend.css?inline";

// Store the nonce globally for style elements
let styleNonce: string | undefined;

/**
 * Set the CSP nonce to be applied to all style elements
 * @param nonce - The CSP nonce value (without 'nonce-' prefix)
 */
export const setStyleNonce = (nonce: string | undefined): void => {
  styleNonce = nonce;

  // Update existing style elements if they exist
  const existingStyleElement = document.getElementById("formbricks__css");
  if (existingStyleElement && nonce) {
    existingStyleElement.setAttribute("nonce", nonce);
  }

  const existingCustomStyleElement = document.getElementById("formbricks__css__custom");
  if (existingCustomStyleElement && nonce) {
    existingCustomStyleElement.setAttribute("nonce", nonce);
  }
};

export const getStyleNonce = (): string | undefined => {
  return styleNonce;
};

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    // oxlint-disable-next-line formbricks/restricted-syntax -- nonce is set below
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";

    // Apply nonce if available
    if (styleNonce) {
      styleElement.setAttribute("nonce", styleNonce);
    }

    // Include survey-ui CSS variables before other styles
    styleElement.textContent = preflight + global + editorCss + surveyUiCss;
    document.head.appendChild(styleElement);
  } else {
    // If style element already exists, update its nonce if needed
    const existingStyleElement = document.getElementById("formbricks__css");
    if (existingStyleElement && styleNonce && !existingStyleElement.getAttribute("nonce")) {
      existingStyleElement.setAttribute("nonce", styleNonce);
    }
  }
};

/**
 * The dark palette as a second variable block. The light block above it is left exactly as it
 * was; appearance switches by flipping `data-appearance` on #fbjs, so both palettes are always in
 * the stylesheet and no CSS is rebuilt on a switch (ENG-2939, ENG-2940).
 *
 * Each color resolves through resolveDarkColors: explicit `.dark` → light value for the brand
 * colors (D12) → a value derived from the brand color. The `!important` rules further down only
 * reference these variables, so they pick up the dark values without being duplicated.
 */
/**
 * survey-ui's base tokens (popover, calendar, muted surfaces) follow the dark palette, so a brand or
 * card override reaches the dropdown and date picker too. Same mapping as the fallback block in
 * survey-ui globals.css.
 */
const getDarkBaseTokens = (dark: ReturnType<typeof resolveDarkColors>): string => {
  const card = dark.cardBackgroundColor;
  const text = dark.elementHeadlineColor;
  const inputBg = dark.inputBgColor;
  const tokens: [string, string | undefined][] = [
    ["background", card],
    ["card", card],
    ["foreground", text],
    ["card-foreground", text],
    ["popover", inputBg],
    ["popover-foreground", text],
    ["secondary", inputBg],
    ["secondary-foreground", text],
    ["muted", inputBg],
    ["muted-foreground", text && inputBg ? mixColor(text, inputBg, 0.3) : undefined],
    ["accent", dark.accentBgColor],
    ["accent-foreground", text],
    ["border", dark.inputBorderColor],
    ["input", text],
  ];
  return tokens
    .filter(([, value]) => value)
    .map(([name, value]) => `  --${name}: ${value};\n`)
    .join("");
};

/**
 * The brand stays as typed for fills (D12); text, the focus ring and the error red are lightened just
 * enough to stay readable on this card.
 */
const getDarkReadableTokens = (dark: ReturnType<typeof resolveDarkColors>): string => {
  const card = dark.cardBackgroundColor;
  if (!card) return "";
  const readable = getDarkReadableColors(dark.brandColor ?? DEFAULT_DARK_BRAND_COLOR, card);
  return (
    `  --fb-brand-readable-color: ${readable.brandTextColor};\n` +
    `  --fb-focus-ring-outer-color: ${readable.focusRingColor};\n` +
    `  --destructive: ${readable.errorColor};\n`
  );
};

export const getDarkThemeCss = (rawStyling: TWorkspaceStyling | TSurveyStyling): string => {
  // Stored styling can predate write-time validation: unsafe values fall back as if unset (ENG-2950).
  const styling = sanitizeThemeStyling(rawStyling);
  const dark = resolveDarkColors(styling);
  let css = '#fbjs[data-appearance="dark"] {\n  color-scheme: dark;\n';
  const add = (variableName: string, value?: string | null) => {
    if (value !== undefined && value !== null) css += `  --fb-${variableName}: ${value};\n`;
  };

  const card = dark.cardBackgroundColor;
  const text = dark.elementHeadlineColor;
  const inputBg = dark.inputBgColor;

  add("brand-color", dark.brandColor);
  add("survey-brand-color", dark.brandColor);
  add("focus-color", dark.brandColor);
  if (dark.brandColor) add("brand-text-color", isLight(dark.brandColor) ? "black" : "white");

  add("heading-color", text);
  add("element-headline-color", text);
  add("element-description-color", dark.elementDescriptionColor);
  add("subheading-color", dark.elementDescriptionColor);
  add("label-color", dark.elementUpperLabelColor);
  add("element-upper-label-color", dark.elementUpperLabelColor);
  if (text) {
    add("signature-text-color", mixColor(text, "#000000", 0.2));
    add("branding-text-color", mixColor(text, "#000000", 0.3));
  }

  add("survey-background-color", card);
  add("survey-border-color", dark.cardBorderColor);
  // Tailwind's default border color (the v3 compatibility rule in global.css). Light gray on a dark
  // card would outline every default-bordered element, so it follows the dark card border instead.
  if (dark.cardBorderColor) css += `  --color-gray-200: ${dark.cardBorderColor};\n`;
  add("card-border-color", dark.cardBorderColor);
  add("highlight-border-color", dark.highlightBorderColor);

  add("input-color", dark.inputTextColor);
  add("input-text-color", dark.inputTextColor);
  if (dark.inputTextColor && inputBg) {
    // Light mode mixes the placeholder toward white; on a dark field it fades toward the field.
    const placeholder = mixColor(dark.inputTextColor, inputBg, 0.3);
    add("placeholder-color", placeholder);
    add("input-placeholder-color", placeholder);
  }
  add("border-color", dark.inputBorderColor);
  add("input-border-color", dark.inputBorderColor);
  if (dark.inputBorderColor) add("border-color-highlight", mixColor(dark.inputBorderColor, "#ffffff", 0.1));
  add("input-background-color", inputBg);
  add("input-bg-color", inputBg);
  if (inputBg) {
    add("input-background-color-selected", mixColor(inputBg, "#ffffff", 0.05));
    add("hover-bg-color", mixColor(inputBg, "#ffffff", 0.08));
  }
  // The light default shadow reads as a dark smudge on a dark field; a shadow the customer set (often an
  // outline drawn with an inset shadow) is theirs and stays. Written out either way: the dark fallback in
  // survey-ui globals.css sets `none` with a more specific selector than the light value.
  const isDefaultShadow = !styling.inputShadow || styling.inputShadow === DEFAULT_INPUT_SHADOW;
  add("input-shadow", isDefaultShadow ? "none" : styling.inputShadow);

  add("option-bg-color", dark.optionBgColor);
  add("option-label-color", dark.optionLabelColor);
  add("option-border-color", dark.optionBorderColor);

  add("accent-background-color", dark.accentBgColor);
  add("accent-background-color-selected", dark.accentBgColorSelected);

  const buttonBg = dark.buttonBgColor;
  const buttonText = dark.buttonTextColor ?? (buttonBg && (isLight(buttonBg) ? "#0f172a" : "#ffffff"));
  add("button-bg-color", buttonBg);
  add("button-text-color", buttonText);
  // Same rule as light: the ghost Back button shows the button color as text on the card. Without a
  // button color it is the brand (or the default brand), which on a dark card is never readable as is.
  if (card) {
    add("back-button-color", ensureReadable(buttonBg ?? dark.brandColor ?? DEFAULT_DARK_BRAND_COLOR, card));
  }

  add("progress-track-bg-color", dark.progressTrackBgColor);
  add("progress-indicator-bg-color", dark.progressIndicatorBgColor);

  // Hover / selected states lighten a dark surface instead of darkening it (survey-ui tokens).
  add("shade-color", "white");
  if (card) add("tint-color", card);

  css += getDarkBaseTokens(dark);

  css += getDarkReadableTokens(dark);

  return `${css}}\n`;
};

type TThemeStyling = TWorkspaceStyling | TSurveyStyling;

/** Appends `--fb-<name>: <value>;` for a value that is not undefined or null. */
type TAppendCssVariable = (variableName: string, value?: string | null) => void;

/** A CSS length: a number, or a numeric string, in px; any other string as is. */
const formatDimension = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return `${value}px`;
  }
  if (typeof value === "string" && !Number.isNaN(Number(value))) {
    return `${value}px`;
  }
  return value;
};

/** A font weight as text, or undefined when it is unset (undefined or null). */
const formatFontWeight = (value: string | number | null | undefined) =>
  value === undefined || value === null ? undefined : `${value}`;

/** The style element the custom theme is written into, created (with the CSP nonce) the first time. */
const getCustomStyleElement = (): HTMLStyleElement => {
  // Check if the style element already exists
  let styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement | null;

  // If the style element exists, update nonce if needed
  if (styleElement) {
    // Update nonce if it wasn't set before
    if (styleNonce && !styleElement.getAttribute("nonce")) {
      styleElement.setAttribute("nonce", styleNonce);
    }
    return styleElement;
  }

  // Create it and append to the head
  // oxlint-disable-next-line formbricks/restricted-syntax -- nonce is set below
  styleElement = document.createElement("style");
  styleElement.id = "formbricks__css__custom";

  // Apply nonce if available
  if (styleNonce) {
    styleElement.setAttribute("nonce", styleNonce);
  }

  document.head.appendChild(styleElement);
  return styleElement;
};

/** Brand, text, input border and card colors, and the radii the roundness sets. */
const appendBaseVariables = (
  styling: TThemeStyling,
  roundness: number | string,
  append: TAppendCssVariable
) => {
  append("brand-color", styling.brandColor?.light);
  append("survey-brand-color", styling.brandColor?.light);
  append("focus-color", styling.brandColor?.light);
  if (styling.brandColor?.light) {
    // If the brand color is defined, set the text color based on the lightness of the brand color
    append("brand-text-color", isLight(styling.brandColor.light) ? "black" : "white");
  } else {
    // If the brand color is undefined, default to white
    append("brand-text-color", "#ffffff");
  }

  append("heading-color", styling.elementHeadlineColor?.light);
  append("element-headline-color", styling.elementHeadlineColor?.light);
  append("element-description-color", styling.elementDescriptionColor?.light);
  append("input-color", styling.inputTextColor?.light);
  append("label-color", styling.elementUpperLabelColor?.light);
  append("subheading-color", styling.elementDescriptionColor?.light);

  const placeholderBaseColor = styling.inputTextColor?.light;
  if (placeholderBaseColor) {
    append("placeholder-color", mixColor(placeholderBaseColor, "#ffffff", 0.3));
    append("input-placeholder-color", mixColor(placeholderBaseColor, "#ffffff", 0.3));
  }

  append("border-color", styling.inputBorderColor?.light);

  if (styling.inputBorderColor?.light) {
    append("border-color-highlight", mixColor(styling.inputBorderColor.light, "#000000", 0.1));
    append("input-border-color", styling.inputBorderColor?.light);
  }

  append("survey-background-color", styling.cardBackgroundColor?.light);
  append("survey-border-color", styling.cardBorderColor?.light);
  append("border-radius", formatDimension(roundness));
  append("input-border-radius", formatDimension(roundness));
  append("option-border-radius", formatDimension(roundness));
  append("button-border-radius", formatDimension(roundness));
  append("input-background-color", styling.inputBgColor?.light);
  append("input-bg-color", styling.inputBgColor?.light);
  append("option-bg-color", styling.optionBgColor?.light);
  append("input-color", styling.inputTextColor?.light);
};

/** Colors derived from the headline, input background and brand colors. */
const appendDerivedColorVariables = (styling: TThemeStyling, append: TAppendCssVariable) => {
  if (styling.elementHeadlineColor?.light) {
    const isLightHeadlineColor = isLight(styling.elementHeadlineColor.light);
    const signatureColor = mixColor(
      styling.elementHeadlineColor.light,
      isLightHeadlineColor ? "#000000" : "#ffffff",
      0.2
    );
    const brandingColor = mixColor(
      styling.elementHeadlineColor.light,
      isLightHeadlineColor ? "#000000" : "#ffffff",
      0.3
    );

    append("signature-text-color", signatureColor);
    append("branding-text-color", brandingColor);
  }

  if (styling.inputBgColor?.light) {
    if (
      styling.inputBgColor.light === "#fff" ||
      styling.inputBgColor.light === "#ffffff" ||
      styling.inputBgColor.light === "white"
    ) {
      append("input-background-color-selected", "var(--slate-50)");
    } else {
      append("input-background-color-selected", mixColor(styling.inputBgColor.light, "#000000", 0.025));
    }
  }

  if (styling.brandColor?.light) {
    const brandColor = styling.brandColor.light;

    const accentColor = mixColor(brandColor, "#ffffff", 0.8);
    const accentColorSelected = mixColor(brandColor, "#ffffff", 0.7);

    append("accent-background-color", accentColor);
    append("accent-background-color-selected", accentColorSelected);

    if (isLight(brandColor)) {
      append("calendar-tile-color", mixColor(brandColor, "#000000", 0.7));
    }
  }
};

/** Buttons (Advanced). A size left unset writes nothing. */
const appendButtonVariables = (
  styling: TThemeStyling,
  buttonBg: string | undefined,
  buttonText: string | undefined,
  append: TAppendCssVariable
) => {
  append("button-bg-color", buttonBg);
  append("button-text-color", buttonText);
  // The ghost "Back" button renders the brand (button bg) as text directly on the card surface,
  // where a light brand fails contrast. Darken it toward readable while keeping the brand hue.
  if (buttonBg) {
    const backButtonSurface = styling.cardBackgroundColor?.light ?? "#ffffff";
    append("back-button-color", ensureReadable(buttonBg, backButtonSurface));
  }
  append("button-border-radius", formatDimension(styling.buttonBorderRadius));
  append("button-height", formatDimension(styling.buttonHeight));
  append("button-font-size", formatDimension(styling.buttonFontSize));
  append("button-font-weight", formatFontWeight(styling.buttonFontWeight));
  append("button-padding-x", formatDimension(styling.buttonPaddingX));
  append("button-padding-y", formatDimension(styling.buttonPaddingY));
};

/** Inputs and options (Advanced). A size left unset writes nothing. */
const appendInputAndOptionVariables = (styling: TThemeStyling, append: TAppendCssVariable) => {
  // Inputs (Advanced)
  append("input-background-color", styling.inputBgColor?.light);
  const inputTextColor = styling.inputTextColor?.light;
  append("input-text-color", inputTextColor);
  if (inputTextColor) {
    append("input-placeholder-color", mixColor(inputTextColor, "#ffffff", 0.3));
  }
  append("input-border-radius", formatDimension(styling.inputBorderRadius));
  append("input-height", formatDimension(styling.inputHeight));
  append("input-font-size", formatDimension(styling.inputFontSize));
  append("input-padding-x", formatDimension(styling.inputPaddingX));
  append("input-padding-y", formatDimension(styling.inputPaddingY));
  if (styling.inputPlaceholderOpacity !== undefined)
    append("input-placeholder-opacity", `${styling.inputPlaceholderOpacity}`);
  append("input-shadow", styling.inputShadow);

  // Options (Advanced)
  append("option-bg-color", styling.optionBgColor?.light);
  append("option-label-color", styling.optionLabelColor?.light);
  if (styling.optionBorderColor?.light) append("option-border-color", styling.optionBorderColor.light);
  append("option-border-radius", formatDimension(styling.optionBorderRadius));
  append("option-padding-x", formatDimension(styling.optionPaddingX));
  append("option-padding-y", formatDimension(styling.optionPaddingY));
  append("option-font-size", formatDimension(styling.optionFontSize));
};

/** Element headline, description and upper label (Advanced), and the progress bar. */
const appendLabelAndProgressVariables = (
  styling: TThemeStyling,
  roundness: number | string,
  append: TAppendCssVariable
) => {
  // Element Headline & Description (Advanced)
  append("element-headline-font-size", formatDimension(styling.elementHeadlineFontSize));
  append("element-headline-font-weight", formatFontWeight(styling.elementHeadlineFontWeight));
  append("element-headline-color", styling.elementHeadlineColor?.light);

  append("element-description-font-size", formatDimension(styling.elementDescriptionFontSize));
  append("element-description-font-weight", formatFontWeight(styling.elementDescriptionFontWeight));
  append("element-description-color", styling.elementDescriptionColor?.light);

  append("element-upper-label-font-size", formatDimension(styling.elementUpperLabelFontSize ?? 12));
  append("element-upper-label-color", styling.elementUpperLabelColor?.light);

  if (styling.elementUpperLabelColor?.light) {
    append("element-upper-label-opacity", "1");
  }

  append("element-upper-label-font-weight", `${styling.elementUpperLabelFontWeight ?? "normal"}`);

  // Progress Bar (Advanced)
  append("progress-track-height", formatDimension(styling.progressTrackHeight));

  // Implicitly set the progress track border radius to the roundness of the card
  append("progress-track-border-radius", formatDimension(roundness));

  append("progress-track-bg-color", styling.progressTrackBgColor?.light);
  append("progress-indicator-bg-color", styling.progressIndicatorBgColor?.light);
};

const isSet = (value: unknown): boolean => value !== undefined && value !== null;

/** The declarations whose condition holds, in order. */
const joinDeclarations = (entries: [boolean, string][]): string =>
  entries
    .filter(([applies]) => applies)
    .map(([, declaration]) => declaration)
    .join("");

/** `selector { declarations }`, or nothing for empty declarations. */
const cssRule = (selector: string, declarations: string): string =>
  declarations.trim() ? `${selector} {\n${declarations}}\n` : "";

// Formatted text inside the headline and description hooks inherits these from the hook element, as in
// survey-ui's globals.css, so Custom CSS on the hook reaches it. Same specificity as the `.label-* *`
// rule it follows, so it wins by order while the bold rule (`.label-headline strong`) still wins.
const toInherited = (declarations: string) =>
  declarations.replaceAll(/: var\([^)]*\) !important;/g, ": inherit !important;");

/** Headline, description and upper label overrides. */
const getLabelRules = (styling: TThemeStyling): string => {
  // --- Headlines ---
  const headlineDecls = joinDeclarations([
    [
      styling.elementHeadlineFontSize !== undefined,
      "  font-size: var(--fb-element-headline-font-size) !important;\n",
    ],
    [
      isSet(styling.elementHeadlineFontWeight),
      "  font-weight: var(--fb-element-headline-font-weight) !important;\n",
    ],
    [Boolean(styling.elementHeadlineColor?.light), "  color: var(--fb-element-headline-color) !important;\n"],
  ]);

  // --- Descriptions ---
  const descriptionDecls = joinDeclarations([
    [
      styling.elementDescriptionFontSize !== undefined,
      "  font-size: var(--fb-element-description-font-size) !important;\n",
    ],
    [
      isSet(styling.elementDescriptionFontWeight),
      "  font-weight: var(--fb-element-description-font-weight) !important;\n",
    ],
    [
      Boolean(styling.elementDescriptionColor?.light),
      "  color: var(--fb-element-description-color) !important;\n",
    ],
  ]);

  // --- Upper labels ---
  const upperDecls = joinDeclarations([
    [
      styling.elementUpperLabelFontSize !== undefined,
      "  font-size: var(--fb-element-upper-label-font-size) !important;\n",
    ],
    [
      isSet(styling.elementUpperLabelFontWeight),
      "  font-weight: var(--fb-element-upper-label-font-weight) !important;\n",
    ],
    [
      Boolean(styling.elementUpperLabelColor?.light),
      "  color: var(--fb-element-upper-label-color) !important;\n" +
        "  opacity: var(--fb-element-upper-label-opacity, 1) !important;\n",
    ],
  ]);

  return (
    cssRule("#fbjs .label-headline,\n#fbjs .label-headline *", headlineDecls) +
    cssRule('#fbjs [data-fb-part="headline"] *', toInherited(headlineDecls)) +
    cssRule("#fbjs .label-description,\n#fbjs .label-description *", descriptionDecls) +
    cssRule('#fbjs [data-fb-part="description"] *', toInherited(descriptionDecls)) +
    cssRule("#fbjs .label-card,\n#fbjs .label-card *", upperDecls)
  );
};

/** Button overrides. */
const getButtonRules = (
  styling: TThemeStyling,
  buttonBg: string | undefined,
  buttonText: string | undefined
): string => {
  const buttonDecls = joinDeclarations([
    [Boolean(buttonBg), "  background-color: var(--fb-button-bg-color) !important;\n"],
    [Boolean(buttonText), "  color: var(--fb-button-text-color) !important;\n"],
    [
      styling.buttonBorderRadius !== undefined,
      "  border-radius: var(--fb-button-border-radius) !important;\n",
    ],
    [styling.buttonHeight !== undefined, "  height: var(--fb-button-height) !important;\n"],
    [styling.buttonFontSize !== undefined, "  font-size: var(--fb-button-font-size) !important;\n"],
    [isSet(styling.buttonFontWeight), "  font-weight: var(--fb-button-font-weight) !important;\n"],
    [
      styling.buttonPaddingX !== undefined,
      "  padding-left: var(--fb-button-padding-x) !important;\n" +
        "  padding-right: var(--fb-button-padding-x) !important;\n",
    ],
    [
      styling.buttonPaddingY !== undefined,
      "  padding-top: var(--fb-button-padding-y) !important;\n" +
        "  padding-bottom: var(--fb-button-padding-y) !important;\n",
    ],
  ]);
  return cssRule("#fbjs .button-custom,\n#fbjs button.button-custom", buttonDecls);
};

/** Option and input overrides. */
const getOptionAndInputRules = (styling: TThemeStyling): string => {
  const optionLabelDecls = joinDeclarations([
    [Boolean(styling.optionLabelColor?.light), "  color: var(--fb-option-label-color) !important;\n"],
    [styling.optionFontSize !== undefined, "  font-size: var(--fb-option-font-size) !important;\n"],
  ]);
  const inputTextDecls = joinDeclarations([
    [Boolean(styling.inputTextColor?.light), "  color: var(--fb-input-text-color) !important;\n"],
    [styling.inputFontSize !== undefined, "  font-size: var(--fb-input-font-size) !important;\n"],
  ]);

  return joinDeclarations([
    // --- Options ---
    [
      styling.optionBorderRadius !== undefined,
      cssRule("#fbjs .rounded-option", "  border-radius: var(--fb-option-border-radius) !important;\n"),
    ],
    [
      Boolean(styling.optionBorderColor?.light),
      cssRule("#fbjs .border-option-border", "  border-color: var(--fb-option-border-color) !important;\n"),
    ],
    [
      Boolean(styling.optionBgColor?.light),
      cssRule("#fbjs .bg-option-bg", "  background-color: var(--fb-option-bg-color) !important;\n"),
    ],
    [true, cssRule("#fbjs .text-option-label", optionLabelDecls)],
    [
      styling.optionPaddingX !== undefined,
      cssRule(
        "#fbjs .px-option-x",
        "  padding-left: var(--fb-option-padding-x) !important;\n  padding-right: var(--fb-option-padding-x) !important;\n"
      ),
    ],
    [
      styling.optionPaddingY !== undefined,
      cssRule(
        "#fbjs .py-option-y",
        "  padding-top: var(--fb-option-padding-y) !important;\n  padding-bottom: var(--fb-option-padding-y) !important;\n"
      ),
    ],
    // --- Inputs ---
    [
      styling.inputBorderRadius !== undefined,
      cssRule("#fbjs .rounded-input", "  border-radius: var(--fb-input-border-radius) !important;\n"),
    ],
    [
      Boolean(styling.inputBgColor?.light),
      cssRule("#fbjs .bg-input-bg", "  background-color: var(--fb-input-background-color) !important;\n"),
    ],
    [
      Boolean(styling.inputBorderColor?.light),
      cssRule("#fbjs .border-input-border", "  border-color: var(--fb-input-border-color) !important;\n"),
    ],
    [true, cssRule("#fbjs .text-input-text", inputTextDecls)],
    [
      styling.inputPaddingX !== undefined,
      cssRule(
        "#fbjs .px-input-x",
        "  padding-left: var(--fb-input-padding-x) !important;\n  padding-right: var(--fb-input-padding-x) !important;\n"
      ),
    ],
    [
      styling.inputPaddingY !== undefined,
      cssRule(
        "#fbjs .py-input-y",
        "  padding-top: var(--fb-input-padding-y) !important;\n  padding-bottom: var(--fb-input-padding-y) !important;\n"
      ),
    ],
  ]);
};

/** Progress bar overrides. */
const getProgressRules = (styling: TThemeStyling): string => {
  let rules = "";
  if (styling.progressTrackHeight !== undefined) {
    rules += cssRule(
      "html body #fbjs div.progress-track",
      "  border-radius: var(--fb-progress-track-border-radius) var(--fb-progress-track-border-radius) 0 0 !important;\n" +
        "  height: var(--fb-progress-track-height) !important;\n" +
        "  min-height: var(--fb-progress-track-height) !important;\n" +
        "  max-height: none !important;\n" +
        "  overflow: hidden !important;\n"
    );
    rules += cssRule(
      "html body #fbjs div.progress-indicator",
      "  height: 100% !important;\n  border-radius: 0 !important;\n"
    );
  }

  return (
    rules +
    cssRule("html body #fbjs .cardless-progress-bar div.progress-track", "  border-radius: 0 !important;\n")
  );
};

export const addCustomThemeToDom = ({
  styling: rawStyling,
  pageFont = false,
}: {
  styling: TWorkspaceStyling | TSurveyStyling;
  /** Page font (ENG-3864): the host passes it; it is never read from `styling`. */
  pageFont?: boolean;
}): void => {
  // Every styling value below is written into stylesheet text, and stored styling can predate write-time
  // validation: an unsafe value (one that could add declarations or rules) falls back as if it were
  // unset, while valid values pass through unchanged (ENG-2950).
  const styling = sanitizeThemeStyling(rawStyling);

  const styleElement = getCustomStyleElement();

  // Start the CSS string with #fbjs
  let cssVariables = "#fbjs {\n";

  // Helper function to append the variable if it's not undefined
  const appendCssVariable: TAppendCssVariable = (variableName, value) => {
    if (value !== undefined && value !== null) {
      cssVariables += `--fb-${variableName}: ${value};\n`;
    }
  };
  // if roundness is defined, even if it's 0, set the border-radius
  const roundness = styling.roundness ?? 8;

  appendBaseVariables(styling, roundness, appendCssVariable);
  appendDerivedColorVariables(styling, appendCssVariable);

  // Buttons (Advanced)
  const buttonBg = styling.buttonBgColor?.light;
  let buttonText = styling.buttonTextColor?.light;
  if (buttonText === undefined && buttonBg) {
    buttonText = isLight(buttonBg) ? "#0f172a" : "#ffffff";
  }
  appendButtonVariables(styling, buttonBg, buttonText, appendCssVariable);
  appendInputAndOptionVariables(styling, appendCssVariable);
  appendLabelAndProgressVariables(styling, roundness, appendCssVariable);

  // Close the #fbjs variable block
  cssVariables += "}\n";

  // ---------------------------------------------------------------------------
  // Conditional !important overrides
  //
  // Only emit rules for properties the user has *explicitly* set.  This ensures
  // the Tailwind baseline classes are used when no custom value is provided,
  // and prevents the brand-color change from cascading into unrelated elements
  // (e.g. button bg, headline color) unless the user opted in.
  // ---------------------------------------------------------------------------
  cssVariables += getLabelRules(styling);
  cssVariables += getButtonRules(styling, buttonBg, buttonText);
  cssVariables += getOptionAndInputRules(styling);
  cssVariables += getProgressRules(styling);

  cssVariables += getDarkThemeCss(styling);

  // Page font (ENG-3864): every element inherits its font from #fbjs, which inherits the page's, instead
  // of the survey font preflight sets on `#fbjs *`. `:root` outranks that rule wherever either loads.
  if (pageFont) {
    cssVariables +=
      ":root #fbjs *,\n:root #fbjs ::before,\n:root #fbjs ::after {\n  font-family: inherit;\n}\n";
  }

  // CSS text, never markup
  styleElement.textContent = cssVariables;
};
