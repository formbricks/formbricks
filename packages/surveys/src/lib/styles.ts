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

  // Start the innerHTML string with :root
  let cssVariables = ":root {\n";

  // Helper function to append the variable if it's not undefined
  const appendCssVariable = (variableName: string, value?: string) => {
    if (value !== undefined) {
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

  appendCssVariable("survey-background-color", styling.cardBackgroundColor?.light);
  appendCssVariable("survey-border-color", styling.cardBorderColor?.light);
  appendCssVariable("border-radius", `${Number(roundness).toString()}px`);
  appendCssVariable("input-border-radius", `${Number(roundness).toString()}px`);
  appendCssVariable("option-border-radius", `${Number(roundness).toString()}px`);
  appendCssVariable("button-border-radius", `${Number(roundness).toString()}px`);
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

  // Close the :root block
  cssVariables += "}";

  // Set the innerHTML of the style element
  styleElement.innerHTML = cssVariables;
};
