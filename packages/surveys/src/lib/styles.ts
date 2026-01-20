// Add this import for survey-ui CSS variables
import surveyUiCss from "@formbricks/survey-ui/styles?inline";
import { type TProjectStyling } from "@formbricks/types/project";
import { type TSurveyStyling } from "@formbricks/types/surveys/types";
import { isLight, mixColor } from "@/lib/color";
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
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";

    // Apply nonce if available
    if (styleNonce) {
      styleElement.setAttribute("nonce", styleNonce);
    }

    // Include survey-ui CSS variables before other styles
    styleElement.innerHTML = preflight + global + editorCss + surveyUiCss;
    document.head.appendChild(styleElement);
  } else {
    // If style element already exists, update its nonce if needed
    const existingStyleElement = document.getElementById("formbricks__css");
    if (existingStyleElement && styleNonce && !existingStyleElement.getAttribute("nonce")) {
      existingStyleElement.setAttribute("nonce", styleNonce);
    }
  }
};

export const addCustomThemeToDom = ({ styling }: { styling: TProjectStyling | TSurveyStyling }): void => {
  // Check if the style element already exists
  let styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement | null;

  // If the style element exists, update nonce if needed
  if (styleElement) {
    // Update nonce if it wasn't set before
    if (styleNonce && !styleElement.getAttribute("nonce")) {
      styleElement.setAttribute("nonce", styleNonce);
    }
  } else {
    // Create it and append to the head
    styleElement = document.createElement("style");
    styleElement.id = "formbricks__css__custom";

    // Apply nonce if available
    if (styleNonce) {
      styleElement.setAttribute("nonce", styleNonce);
    }

    document.head.appendChild(styleElement);
  }

  // Start the innerHTML string with #fbjs
  let cssVariables = "#fbjs {\n";

  // Helper function to append the variable if it's not undefined
  const appendCssVariable = (variableName: string, value?: string | null) => {
    if (value !== undefined && value !== null) {
      cssVariables += `--fb-${variableName}: ${value};\n`;
    }
  };
  // if roundness is defined, even if it's 0, set the border-radius
  const roundness = styling.roundness ?? 8;

  // Use the helper function to append CSS variables
  appendCssVariable("brand-color", styling.brandColor?.light);
  appendCssVariable("survey-brand-color", styling.brandColor?.light);
  appendCssVariable("focus-color", styling.brandColor?.light);
  if (styling.brandColor?.light) {
    // If the brand color is defined, set the text color based on the lightness of the brand color
    appendCssVariable("brand-text-color", isLight(styling.brandColor.light) ? "black" : "white");
  } else {
    // If the brand color is undefined, default to white
    appendCssVariable("brand-text-color", "#ffffff");
  }

  // Backwards-compat: legacy variables still used by some consumers/tests
  appendCssVariable("heading-color", styling.questionColor?.light);
  appendCssVariable("element-headline-color", styling.questionColor?.light);
  appendCssVariable("element-description-color", styling.questionColor?.light);
  appendCssVariable("input-color", styling.questionColor?.light);
  appendCssVariable("label-color", styling.questionColor?.light);
  // Backwards-compat: legacy variables still used by some consumers/tests
  appendCssVariable("subheading-color", styling.questionColor?.light);

  if (styling.questionColor?.light) {
    appendCssVariable("placeholder-color", mixColor(styling.questionColor.light, "#ffffff", 0.3));
  }

  appendCssVariable("border-color", styling.inputBorderColor?.light);

  if (styling.inputBorderColor?.light) {
    appendCssVariable("border-color-highlight", mixColor(styling.inputBorderColor.light, "#000000", 0.1));
    appendCssVariable("input-border-color", styling.inputBorderColor?.light);
  }

  // helper function to format dimensions
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

  appendCssVariable("survey-background-color", styling.cardBackgroundColor?.light);
  appendCssVariable("survey-border-color", styling.cardBorderColor?.light);
  appendCssVariable("border-radius", formatDimension(Number(roundness)));
  appendCssVariable("input-border-radius", formatDimension(Number(roundness)));
  appendCssVariable("option-border-radius", formatDimension(Number(roundness)));
  appendCssVariable("button-border-radius", formatDimension(Number(roundness)));
  appendCssVariable("input-background-color", styling.inputColor?.light);
  appendCssVariable("input-bg-color", styling.inputColor?.light);
  appendCssVariable("option-bg-color", styling.inputColor?.light);
  appendCssVariable("input-color", styling.questionColor?.light);

  if (styling.questionColor?.light) {
    const isLightQuestionColor = isLight(styling.questionColor.light);
    const signatureColor = mixColor(
      styling.questionColor.light,
      isLightQuestionColor ? "#000000" : "#ffffff",
      0.2
    );
    const brandingColor = mixColor(
      styling.questionColor.light,
      isLightQuestionColor ? "#000000" : "#ffffff",
      0.3
    );

    appendCssVariable("signature-text-color", signatureColor);
    appendCssVariable("branding-text-color", brandingColor);
  }

  if (styling.inputColor?.light) {
    if (
      styling.inputColor.light === "#fff" ||
      styling.inputColor.light === "#ffffff" ||
      styling.inputColor.light === "white"
    ) {
      appendCssVariable("input-background-color-selected", "var(--slate-50)");
    } else {
      appendCssVariable(
        "input-background-color-selected",
        mixColor(styling.inputColor.light, "#000000", 0.025)
      );
    }
  }

  if (styling.brandColor?.light) {
    const brandColor = styling.brandColor.light;

    const accentColor = mixColor(brandColor, "#ffffff", 0.8);
    const accentColorSelected = mixColor(brandColor, "#ffffff", 0.7);

    appendCssVariable("accent-background-color", accentColor);
    appendCssVariable("accent-background-color-selected", accentColorSelected);

    if (isLight(brandColor)) {
      appendCssVariable("calendar-tile-color", mixColor(brandColor, "#000000", 0.7));
    }
  }

  // Buttons (Advanced)
  appendCssVariable("button-bg-color", styling.buttonBgColor?.light);
  appendCssVariable("button-text-color", styling.buttonTextColor?.light);
  if (styling.buttonBorderRadius !== undefined)
    appendCssVariable("button-border-radius", formatDimension(styling.buttonBorderRadius));
  if (styling.buttonHeight !== undefined)
    appendCssVariable("button-height", formatDimension(styling.buttonHeight));
  if (styling.buttonFontSize !== undefined)
    appendCssVariable("button-font-size", formatDimension(styling.buttonFontSize));
  if (styling.buttonFontWeight !== undefined)
    appendCssVariable("button-font-weight", `${styling.buttonFontWeight}`);
  if (styling.buttonPaddingX !== undefined)
    appendCssVariable("button-padding-x", formatDimension(styling.buttonPaddingX));
  if (styling.buttonPaddingY !== undefined)
    appendCssVariable("button-padding-y", formatDimension(styling.buttonPaddingY));

  // Inputs (Advanced)
  appendCssVariable("input-color", styling.inputTextColor?.light);
  if (styling.inputBorderRadius !== undefined)
    appendCssVariable("input-border-radius", formatDimension(styling.inputBorderRadius));
  if (styling.inputHeight !== undefined)
    appendCssVariable("input-height", formatDimension(styling.inputHeight));
  if (styling.inputFontSize !== undefined)
    appendCssVariable("input-font-size", formatDimension(styling.inputFontSize));
  if (styling.inputPaddingX !== undefined)
    appendCssVariable("input-padding-x", formatDimension(styling.inputPaddingX));
  if (styling.inputPaddingY !== undefined)
    appendCssVariable("input-padding-y", formatDimension(styling.inputPaddingY));
  if (styling.inputPlaceholderOpacity !== undefined)
    appendCssVariable("input-placeholder-opacity", `${styling.inputPlaceholderOpacity}`);
  appendCssVariable("input-shadow", styling.inputShadow);

  // Options (Advanced)
  appendCssVariable("option-bg-color", styling.optionBgColor?.light);
  appendCssVariable("option-label-color", styling.optionLabelColor?.light);
  if (styling.optionBorderRadius !== undefined)
    appendCssVariable("option-border-radius", formatDimension(styling.optionBorderRadius));
  if (styling.optionPaddingX !== undefined)
    appendCssVariable("option-padding-x", formatDimension(styling.optionPaddingX));
  if (styling.optionPaddingY !== undefined)
    appendCssVariable("option-padding-y", formatDimension(styling.optionPaddingY));
  if (styling.optionFontSize !== undefined)
    appendCssVariable("option-font-size", formatDimension(styling.optionFontSize));

  // Element Headline & Description (Advanced)
  if (styling.elementHeadlineFontSize !== undefined)
    appendCssVariable("element-headline-font-size", formatDimension(styling.elementHeadlineFontSize));
  if (styling.elementHeadlineFontWeight !== undefined)
    appendCssVariable("element-headline-font-weight", `${styling.elementHeadlineFontWeight}`);
  appendCssVariable(
    "element-headline-color",
    styling.elementHeadlineColor?.light ?? styling.questionColor?.light
  );

  if (styling.elementDescriptionFontSize !== undefined)
    appendCssVariable("element-description-font-size", formatDimension(styling.elementDescriptionFontSize));
  appendCssVariable(
    "element-description-color",
    styling.elementDescriptionColor?.light ?? styling.questionColor?.light
  );

  // Progress Bar (Advanced)
  if (styling.progressTrackHeight !== undefined)
    appendCssVariable("progress-track-height", formatDimension(styling.progressTrackHeight));
  appendCssVariable("progress-track-bg-color", styling.progressTrackBgColor?.light);
  appendCssVariable("progress-indicator-bg-color", styling.progressIndicatorBgColor?.light);

  // Close the #fbjs block
  cssVariables += "}";

  // Set the innerHTML of the style element
  styleElement.innerHTML = cssVariables;
};
