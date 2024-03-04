import { isLight } from "@/lib/utils";
import global from "@/styles/global.css?inline";
import preflight from "@/styles/preflight.css?inline";

import { TStyling } from "@formbricks/types/styling";

import editorCss from "../../../ui/Editor/stylesEditorFrontend.css?inline";

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = preflight + global + editorCss;
    document.head.appendChild(styleElement);
  }
};

export const addCustomThemeToDom = ({ styling }: { styling: TStyling }) => {
  if (document.getElementById("formbricks__css") === null) return;

  const styleElement = document.createElement("style");
  styleElement.id = "formbricks__css__custom";
  styleElement.innerHTML = `
    :root {
      --fb-brand-color: ${styling.brandColor?.light};
      ${isLight(styling.brandColor?.light ?? "") ? "--fb-brand-text-color: black;" : "--fb-brand-text-color: white;"}
      --fb-heading-color: ${styling.questionColor?.light};
      --fb-border-color: ${styling.inputBorderColor?.light};
      --fb-survey-background-color: ${styling.cardBackgroundColor?.light};
      --fb-border-radius: ${styling.roundness}px;
    }
  `;
  document.head.appendChild(styleElement);
};
