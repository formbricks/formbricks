import global from "@/styles/global.css?inline";
import preflight from "@/styles/preflight.css?inline";

import { isLight, mixColor } from "@formbricks/lib/utils";
import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys";

import editorCss from "../../../ui/Editor/stylesEditorFrontend.css?inline";

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = preflight + global + editorCss;
    document.head.appendChild(styleElement);
  }
};

export const addCustomThemeToDom = ({ styling }: { styling: TProductStyling | TSurveyStyling }) => {
  // Check if the style element already exists
  let styleElement = document.getElementById("formbricks__css__custom");

  // If the style element doesn't exist, create it and append to the head
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "formbricks__css__custom";
    document.head.appendChild(styleElement);
  }

  // Start the innerHTML string with :root
  let cssVariables = ":root {\n";

  // Helper function to append the variable if it's not undefined
  const appendCssVariable = (variableName: string, value: string | undefined) => {
    if (value !== undefined) {
      cssVariables += `--fb-${variableName}: ${value};\n`;
    }
  };

  // if roundness is defined, even if it's 0, set the border-radius
  const roundness = styling.roundness ?? 8;

  // Use the helper function to append CSS variables
  appendCssVariable("brand-color", styling.brandColor?.light);
  if (!!styling.brandColor?.light) {
    // If the brand color is defined, set the text color based on the lightness of the brand color
    cssVariables += `--fb-brand-text-color: ${isLight(styling.brandColor?.light) ? "black" : "white"};\n`;
  } else {
    // If the brand color is undefined, default to white
    cssVariables += `--fb-brand-text-color: white;\n`;
  }
  appendCssVariable("heading-color", styling.questionColor?.light);
  appendCssVariable("subheading-color", styling.questionColor?.light);
  appendCssVariable("border-color", styling.inputBorderColor?.light);
  appendCssVariable("survey-background-color", styling.cardBackgroundColor?.light);
  appendCssVariable("survey-border-color", styling.cardBorderColor?.light);
  appendCssVariable("border-radius", `${roundness}px`);
  appendCssVariable("input-background-color", styling.inputColor?.light);

  if (styling.questionColor?.light) {
    let signatureColor = "";
    let brandingColor = "";

    if (isLight(styling.questionColor?.light)) {
      signatureColor = mixColor(styling.questionColor?.light, "#000000", 0.2);
      brandingColor = mixColor(styling.questionColor?.light, "#000000", 0.3);
    } else {
      signatureColor = mixColor(styling.questionColor?.light, "#ffffff", 0.2);
      brandingColor = mixColor(styling.questionColor?.light, "#ffffff", 0.3);
    }

    appendCssVariable("signature-text-color", signatureColor);
    appendCssVariable("branding-text-color", brandingColor);
  }

  if (!!styling.inputColor?.light) {
    if (
      styling.inputColor.light === "#fff" ||
      styling.inputColor.light === "#ffffff" ||
      styling.inputColor.light === "white"
    ) {
      appendCssVariable("input-background-color-selected", "rgb(248, 250, 252)");
    } else {
      appendCssVariable(
        "input-background-color-selected",
        mixColor(styling.inputColor?.light, "#ffffff", 0.2)
      );
    }
  }

  if (styling.brandColor?.light) {
    const brandColor = styling.brandColor.light;

    const mixedBrandColor = mixColor(brandColor, "#ffffff", 0.8);
    const mixedBrandColorSelected = mixColor(brandColor, "#ffffff", 0.7);

    appendCssVariable("accent-background-color", mixedBrandColor);
    appendCssVariable("accent-background-color-selected", mixedBrandColorSelected);
  }

  // Close the :root block
  cssVariables += "}";

  // Set the innerHTML of the style element
  styleElement.innerHTML = cssVariables;
};
