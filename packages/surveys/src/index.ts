import { h, render } from "preact";
import { type SurveyInlineProps, type SurveyModalProps } from "@formbricks/types/formbricks-surveys";
import { SurveyInline } from "@/components/general/survey-inline";
import { SurveyModal } from "@/components/general/survey-modal";
import { addCustomThemeToDom, addStylesToDom } from "@/lib/styles";

export const renderSurveyInline = (props: SurveyInlineProps) => {
  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });

  const element = document.getElementById(props.containerId);
  if (!element) {
    throw new Error(`renderSurvey: Element with id ${props.containerId} not found.`);
  }
  render(h(SurveyInline, props), element);
};

export const renderSurveyModal = (props: SurveyModalProps) => {
  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });

  // add container element to DOM
  const element = document.createElement("div");
  element.id = "formbricks-modal-container";
  document.body.appendChild(element);
  render(h(SurveyModal, props), element);
};

if (typeof window !== "undefined") {
  window.formbricksSurveys = {
    renderSurveyInline,
    renderSurveyModal,
  };
}
