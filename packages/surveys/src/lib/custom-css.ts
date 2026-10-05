import type { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { getStyleNonce } from "./styles";

/** Only server-processed CSS reaches this boundary. Rules already carry scope and important priority. */
export const applyCustomCss = (css: SurveyContainerProps["customCss"]): void => {
  let element = document.getElementById("formbricks__css__customer") as HTMLStyleElement | null;
  const layers = [
    ["fb-workspace", css?.workspace?.light],
    ["fb-workspace-dark", css?.workspace?.dark],
    ["fb-survey", css?.survey?.light],
    ["fb-survey-dark", css?.survey?.dark],
  ];
  const text = layers
    .filter(([, rules]) => rules)
    .map(([layer, rules]) => `@layer ${layer} {\n${rules}\n}`)
    .join("\n");
  if (!text) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("style");
    element.id = "formbricks__css__customer";
    document.head.appendChild(element);
  }
  const nonce = getStyleNonce();
  if (nonce) element.setAttribute("nonce", nonce);
  element.textContent = text;
};
