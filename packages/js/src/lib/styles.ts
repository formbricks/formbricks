import css from "../style.css";
import preflight from "../preflight.css";
import editorCss from "../../../ui/editor/stylesEditorFrontend.css";

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = preflight + css + editorCss;
    document.head.appendChild(styleElement);
  }
};
