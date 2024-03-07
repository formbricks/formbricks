import { isLight } from "@/lib/utils";
import global from "@/styles/global.css?inline";
import preflight from "@/styles/preflight.css?inline";

import { hexToRGBA, lightenDarkenColor } from "@formbricks/lib/utils";
import { TProductStyling } from "@formbricks/types/product";

import editorCss from "../../../ui/Editor/stylesEditorFrontend.css?inline";

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = preflight + global + editorCss;
    document.head.appendChild(styleElement);
  }
};

export const addCustomThemeToDom = ({ styling }: { styling: TProductStyling }) => {
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
  appendCssVariable("border-color", styling.inputBorderColor?.light);
  appendCssVariable("survey-background-color", styling.cardBackgroundColor?.light);
  appendCssVariable("border-radius", styling.roundness ? `${styling.roundness}px` : undefined);
  appendCssVariable("input-background-color", styling.inputColor?.light);
  if (!!styling.inputColor?.light) {
    appendCssVariable("input-background-color-selected", lightenDarkenColor(styling.inputColor?.light, -20));
  }
  appendCssVariable("accent-background-color", hexToRGBA(styling.brandColor?.light ?? "", 0.1));
  appendCssVariable("accent-selected-background-color", hexToRGBA(styling.brandColor?.light ?? "", 0.2));

  // Close the :root block
  cssVariables += "}";

  // Set the innerHTML of the style element
  styleElement.innerHTML = cssVariables;
};
