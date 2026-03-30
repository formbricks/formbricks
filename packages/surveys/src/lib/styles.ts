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

  const placeholderBaseColor = styling.inputTextColor?.light ?? styling.questionColor?.light;
  if (placeholderBaseColor) {
    appendCssVariable("placeholder-color", mixColor(placeholderBaseColor, "#ffffff", 0.3));
    appendCssVariable("input-placeholder-color", mixColor(placeholderBaseColor, "#ffffff", 0.3));
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
  appendCssVariable("border-radius", formatDimension(roundness));
  appendCssVariable("input-border-radius", formatDimension(roundness));
  appendCssVariable("option-border-radius", formatDimension(roundness));
  appendCssVariable("button-border-radius", formatDimension(roundness));
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
  const buttonBg = styling.buttonBgColor?.light ?? styling.brandColor?.light;
  let buttonText = styling.buttonTextColor?.light;
  if (buttonText === undefined && buttonBg) {
    buttonText = isLight(buttonBg) ? "#0f172a" : "#ffffff";
  }
  appendCssVariable("button-bg-color", buttonBg);
  appendCssVariable("button-text-color", buttonText);
  if (styling.buttonBorderRadius !== undefined)
    appendCssVariable("button-border-radius", formatDimension(styling.buttonBorderRadius));
  if (styling.buttonHeight !== undefined)
    appendCssVariable("button-height", formatDimension(styling.buttonHeight));
  if (styling.buttonFontSize !== undefined)
    appendCssVariable("button-font-size", formatDimension(styling.buttonFontSize));
  if (styling.buttonFontWeight !== undefined && styling.buttonFontWeight !== null)
    appendCssVariable("button-font-weight", `${styling.buttonFontWeight}`);
  if (styling.buttonPaddingX !== undefined)
    appendCssVariable("button-padding-x", formatDimension(styling.buttonPaddingX));
  if (styling.buttonPaddingY !== undefined)
    appendCssVariable("button-padding-y", formatDimension(styling.buttonPaddingY));

  // Inputs (Advanced)
  appendCssVariable("input-background-color", styling.inputBgColor?.light ?? styling.inputColor?.light);
  const inputTextColor = styling.inputTextColor?.light ?? styling.questionColor?.light;
  appendCssVariable("input-text-color", inputTextColor);
  if (inputTextColor) {
    appendCssVariable("input-placeholder-color", mixColor(inputTextColor, "#ffffff", 0.3));
  }
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
  appendCssVariable("option-bg-color", styling.optionBgColor?.light ?? styling.inputColor?.light);
  appendCssVariable("option-label-color", styling.optionLabelColor?.light ?? styling.questionColor?.light);
  if (styling.optionBorderColor?.light)
    appendCssVariable("option-border-color", styling.optionBorderColor.light);
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
  if (styling.elementHeadlineFontWeight !== undefined && styling.elementHeadlineFontWeight !== null)
    appendCssVariable("element-headline-font-weight", `${styling.elementHeadlineFontWeight}`);
  appendCssVariable(
    "element-headline-color",
    styling.elementHeadlineColor?.light ?? styling.questionColor?.light
  );

  if (styling.elementDescriptionFontSize !== undefined)
    appendCssVariable("element-description-font-size", formatDimension(styling.elementDescriptionFontSize));
  if (styling.elementDescriptionFontWeight !== undefined && styling.elementDescriptionFontWeight !== null)
    appendCssVariable("element-description-font-weight", `${styling.elementDescriptionFontWeight}`);
  appendCssVariable(
    "element-description-color",
    styling.elementDescriptionColor?.light ?? styling.questionColor?.light
  );

  appendCssVariable(
    "element-upper-label-font-size",
    formatDimension(styling.elementUpperLabelFontSize ?? 12)
  );
  appendCssVariable(
    "element-upper-label-color",
    styling.elementUpperLabelColor?.light ?? styling.questionColor?.light
  );

  if (styling.elementUpperLabelColor?.light) {
    appendCssVariable("element-upper-label-opacity", "1");
  }

  appendCssVariable("element-upper-label-font-weight", `${styling.elementUpperLabelFontWeight ?? "normal"}`);

  // Progress Bar (Advanced)
  if (styling.progressTrackHeight !== undefined)
    appendCssVariable("progress-track-height", formatDimension(styling.progressTrackHeight));

  // Implicitly set the progress track border radius to the roundness of the card
  appendCssVariable("progress-track-border-radius", formatDimension(roundness));

  appendCssVariable(
    "progress-track-bg-color",
    styling.progressTrackBgColor?.light ??
      (styling.brandColor?.light ? mixColor(styling.brandColor.light, "#ffffff", 0.8) : undefined)
  );
  appendCssVariable(
    "progress-indicator-bg-color",
    styling.progressIndicatorBgColor?.light ?? styling.brandColor?.light
  );

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

  const addRule = (selector: string, declarations: string) => {
    if (declarations.trim()) {
      cssVariables += `${selector} {\n${declarations}}\n`;
    }
  };

  // --- Headlines ---
  let headlineDecls = "";
  if (styling.elementHeadlineFontSize !== undefined)
    headlineDecls += "  font-size: var(--fb-element-headline-font-size) !important;\n";
  if (styling.elementHeadlineFontWeight !== undefined && styling.elementHeadlineFontWeight !== null)
    headlineDecls += "  font-weight: var(--fb-element-headline-font-weight) !important;\n";
  if (styling.elementHeadlineColor?.light || styling.questionColor?.light)
    headlineDecls += "  color: var(--fb-element-headline-color) !important;\n";
  addRule("#fbjs .label-headline,\n#fbjs .label-headline *", headlineDecls);

  // --- Descriptions ---
  let descriptionDecls = "";
  if (styling.elementDescriptionFontSize !== undefined)
    descriptionDecls += "  font-size: var(--fb-element-description-font-size) !important;\n";
  if (styling.elementDescriptionFontWeight !== undefined && styling.elementDescriptionFontWeight !== null)
    descriptionDecls += "  font-weight: var(--fb-element-description-font-weight) !important;\n";
  if (styling.elementDescriptionColor?.light || styling.questionColor?.light)
    descriptionDecls += "  color: var(--fb-element-description-color) !important;\n";
  addRule("#fbjs .label-description,\n#fbjs .label-description *", descriptionDecls);

  // --- Upper labels ---
  let upperDecls = "";
  if (styling.elementUpperLabelFontSize !== undefined)
    upperDecls += "  font-size: var(--fb-element-upper-label-font-size) !important;\n";
  if (styling.elementUpperLabelFontWeight !== undefined && styling.elementUpperLabelFontWeight !== null)
    upperDecls += "  font-weight: var(--fb-element-upper-label-font-weight) !important;\n";
  if (styling.elementUpperLabelColor?.light || styling.questionColor?.light) {
    upperDecls += "  color: var(--fb-element-upper-label-color) !important;\n";
    upperDecls += "  opacity: var(--fb-element-upper-label-opacity, 1) !important;\n";
  }
  addRule("#fbjs .label-upper,\n#fbjs .label-upper *", upperDecls);

  // --- Buttons ---
  let buttonDecls = "";
  if (styling.buttonBgColor?.light || styling.brandColor?.light)
    buttonDecls += "  background-color: var(--fb-button-bg-color) !important;\n";
  if (styling.buttonTextColor?.light || styling.brandColor?.light)
    buttonDecls += "  color: var(--fb-button-text-color) !important;\n";
  if (styling.buttonBorderRadius !== undefined)
    buttonDecls += "  border-radius: var(--fb-button-border-radius) !important;\n";
  if (styling.buttonHeight !== undefined) buttonDecls += "  height: var(--fb-button-height) !important;\n";
  if (styling.buttonFontSize !== undefined)
    buttonDecls += "  font-size: var(--fb-button-font-size) !important;\n";
  if (styling.buttonFontWeight !== undefined && styling.buttonFontWeight !== null)
    buttonDecls += "  font-weight: var(--fb-button-font-weight) !important;\n";
  if (styling.buttonPaddingX !== undefined) {
    buttonDecls += "  padding-left: var(--fb-button-padding-x) !important;\n";
    buttonDecls += "  padding-right: var(--fb-button-padding-x) !important;\n";
  }
  if (styling.buttonPaddingY !== undefined) {
    buttonDecls += "  padding-top: var(--fb-button-padding-y) !important;\n";
    buttonDecls += "  padding-bottom: var(--fb-button-padding-y) !important;\n";
  }
  addRule("#fbjs .button-custom,\n#fbjs button.button-custom", buttonDecls);

  // --- Options ---
  if (styling.optionBorderRadius !== undefined)
    addRule("#fbjs .rounded-option", "  border-radius: var(--fb-option-border-radius) !important;\n");
  if (styling.optionBorderColor?.light)
    addRule("#fbjs .border-option-border", "  border-color: var(--fb-option-border-color) !important;\n");
  if (styling.optionBgColor?.light || styling.inputColor?.light)
    addRule("#fbjs .bg-option-bg", "  background-color: var(--fb-option-bg-color) !important;\n");

  let optionLabelDecls = "";
  if (styling.optionLabelColor?.light || styling.questionColor?.light)
    optionLabelDecls += "  color: var(--fb-option-label-color) !important;\n";
  if (styling.optionFontSize !== undefined)
    optionLabelDecls += "  font-size: var(--fb-option-font-size) !important;\n";
  addRule("#fbjs .text-option-label", optionLabelDecls);

  if (styling.optionPaddingX !== undefined)
    addRule(
      "#fbjs .px-option-x",
      "  padding-left: var(--fb-option-padding-x) !important;\n  padding-right: var(--fb-option-padding-x) !important;\n"
    );
  if (styling.optionPaddingY !== undefined)
    addRule(
      "#fbjs .py-option-y",
      "  padding-top: var(--fb-option-padding-y) !important;\n  padding-bottom: var(--fb-option-padding-y) !important;\n"
    );

  // --- Inputs ---
  if (styling.inputBorderRadius !== undefined)
    addRule("#fbjs .rounded-input", "  border-radius: var(--fb-input-border-radius) !important;\n");
  if (styling.inputBgColor?.light || styling.inputColor?.light)
    addRule("#fbjs .bg-input-bg", "  background-color: var(--fb-input-background-color) !important;\n");
  if (styling.inputBorderColor?.light)
    addRule("#fbjs .border-input-border", "  border-color: var(--fb-input-border-color) !important;\n");

  let inputTextDecls = "";
  if (styling.inputTextColor?.light || styling.questionColor?.light)
    inputTextDecls += "  color: var(--fb-input-text-color) !important;\n";
  if (styling.inputFontSize !== undefined)
    inputTextDecls += "  font-size: var(--fb-input-font-size) !important;\n";
  addRule("#fbjs .text-input-text", inputTextDecls);

  if (styling.inputPaddingX !== undefined)
    addRule(
      "#fbjs .px-input-x",
      "  padding-left: var(--fb-input-padding-x) !important;\n  padding-right: var(--fb-input-padding-x) !important;\n"
    );
  if (styling.inputPaddingY !== undefined)
    addRule(
      "#fbjs .py-input-y",
      "  padding-top: var(--fb-input-padding-y) !important;\n  padding-bottom: var(--fb-input-padding-y) !important;\n"
    );

  // --- Progress bar ---
  if (styling.progressTrackHeight !== undefined) {
    addRule(
      "html body #fbjs div.progress-track",
      "  border-radius: var(--fb-progress-track-border-radius) var(--fb-progress-track-border-radius) 0 0 !important;\n" +
        "  height: var(--fb-progress-track-height) !important;\n" +
        "  min-height: var(--fb-progress-track-height) !important;\n" +
        "  max-height: none !important;\n" +
        "  overflow: hidden !important;\n"
    );
    addRule(
      "html body #fbjs div.progress-indicator",
      "  height: 100% !important;\n  border-radius: 0 !important;\n"
    );
  }

  // Set the innerHTML of the style element
  styleElement.innerHTML = cssVariables;
};
