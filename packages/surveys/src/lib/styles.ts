import global from "../styles/global.css?inline";
import preflight from "../styles/preflight.css?inline";
import editorCss from "../../../ui/Editor/stylesEditorFrontend.css?inline";

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = preflight + global + editorCss;
    document.head.appendChild(styleElement);
  }
};
