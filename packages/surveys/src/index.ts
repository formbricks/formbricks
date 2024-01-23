import { SurveyInline } from "@/components/general/SurveyInline";
import { SurveyModal } from "@/components/general/SurveyModal";
import { addCustomThemeToDom, addStylesToDom } from "@/lib/styles";
import { h, render } from "preact";

import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricksSurveys";

declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyInlineProps & { brandColor: string }) => void;
      renderSurveyModal: (props: SurveyModalProps & { brandColor: string }) => void;
    };
  }
}

export const renderSurveyInline = (props: SurveyInlineProps & { brandColor: string }) => {
  addStylesToDom();
  addCustomThemeToDom({ brandColor: props.brandColor });

  const element = document.getElementById(props.containerId);
  if (!element) {
    throw new Error(`renderSurvey: Element with id ${props.containerId} not found.`);
  }
  render(h(SurveyInline, props), element);
};

export const renderSurveyModal = (props: SurveyModalProps & { brandColor: string }) => {
  addStylesToDom();
  addCustomThemeToDom({ brandColor: props.brandColor });

  // add container element to DOM
  const element = document.createElement("div");
  element.id = "formbricks-modal-container";
  document.body.appendChild(element);
  render(h(SurveyModal, props), element);
};

window.formbricksSurveys = {
  renderSurveyInline,
  renderSurveyModal,
};
