import css from "../style.css";
import preflight from "../preflight.css";

export const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = preflight + css;
    document.head.appendChild(styleElement);
  }
};
