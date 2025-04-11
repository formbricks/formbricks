import { isLight, mixColor } from "@/lib/color";
import global from "@/styles/global.css?inline";
import preflight from "@/styles/preflight.css?inline";
import calendarCss from "react-calendar/dist/Calendar.css?inline";
import datePickerCss from "react-date-picker/dist/DatePicker.css?inline";
import { type TProjectStyling } from "@formbricks/types/project";
import { type TSurveyStyling } from "@formbricks/types/surveys/types";
import editorCss from "../../../../apps/web/modules/ui/components/editor/styles-editor-frontend.css?inline";
import datePickerCustomCss from "../styles/date-picker.css?inline";

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML =
      preflight + global + editorCss + datePickerCss + calendarCss + datePickerCustomCss;
    document.head.appendChild(styleElement);
  }
};

export const addCustomThemeToDom = ({ styling }: { styling: TProjectStyling | TSurveyStyling }): void => {
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
  const appendCssVariable = (variableName: string, value?: string) => {
    if (value !== undefined) {
      cssVariables += `--${variableName}: ${value};\n`;
    }
  };

  // if roundness is defined, even if it's 0, set the border-radius
  const roundness = styling.roundness ?? 8;

  // Use the helper function to append CSS variables
  appendCssVariable("brand-color", styling.brandColor?.light);
  appendCssVariable("focus-color", styling.brandColor?.light);
  if (styling.brandColor?.light) {
    // If the brand color is defined, set the text color based on the lightness of the brand color
    appendCssVariable("brand-text-color", isLight(styling.brandColor.light) ? "black" : "white");
  } else {
    // If the brand color is undefined, default to white
    appendCssVariable("brand-text-color", "#ffffff");
  }

  if (styling.cardShadowColor?.light) {
    // mix the shadow color with white to get a lighter shadow
    appendCssVariable("survey-shadow-color", mixColor(styling.cardShadowColor.light, "#ffffff", 0.4));
  }

  appendCssVariable("heading-color", styling.questionColor?.light);
  appendCssVariable("subheading-color", styling.questionColor?.light);

  if (styling.questionColor?.light) {
    appendCssVariable("placeholder-color", mixColor(styling.questionColor.light, "#ffffff", 0.3));
  }

  appendCssVariable("border-color", styling.inputBorderColor?.light);

  if (styling.inputBorderColor?.light) {
    appendCssVariable("border-color-highlight", mixColor(styling.inputBorderColor.light, "#000000", 0.1));
  }

  appendCssVariable("survey-background-color", styling.cardBackgroundColor?.light);
  appendCssVariable("survey-border-color", styling.cardBorderColor?.light);
  appendCssVariable("border-radius", `${Number(roundness).toString()}px`);
  appendCssVariable("input-background-color", styling.inputColor?.light);

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
