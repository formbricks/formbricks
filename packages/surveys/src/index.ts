import { RenderSurvey } from "@/components/general/render-survey";
import { addCustomThemeToDom, addStylesToDom } from "@/lib/styles";
import { h, render } from "preact";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";

export const renderSurveyInline = (props: SurveyContainerProps) => {
  const inlineProps: SurveyContainerProps = {
    ...props,
    mode: "inline",
  };

  renderSurvey(inlineProps);
};

export const renderSurvey = (props: SurveyContainerProps) => {
  // render SurveyNew
  // if survey type is link, we don't pass the placement, darkOverlay, clickOutside, onClose

  const { mode, containerId } = props;

  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });

  if (mode === "inline") {
    if (!containerId) {
      throw new Error("renderSurvey: containerId is required for inline mode");
    }

    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
    }

    const { placement, darkOverlay, onClose, ...surveyInlineProps } = props;

    render(h(RenderSurvey, surveyInlineProps), element);
  } else {
    const modalContainer = document.createElement("div");
    modalContainer.id = "formbricks-modal-container";
    document.body.appendChild(modalContainer);

    render(h(RenderSurvey, props), modalContainer);
  }
};

export const renderSurveyModal = renderSurvey;

if (typeof window !== "undefined") {
  window.formbricksSurveys = {
    renderSurveyInline,
    renderSurveyModal,
    renderSurvey,
  };
}
