import { SurveyInline } from "@/components/general/survey-inline";
import { SurveyModal } from "@/components/general/survey-modal";
import { SurveyNew } from "@/components/general/survey-new";
import { ApiClient } from "@/lib/api-client";
import { addCustomThemeToDom, addStylesToDom } from "@/lib/styles";
import { h, render } from "preact";
import {
  SurveyContainerProps,
  type SurveyInlineProps,
  type SurveyModalProps,
} from "@formbricks/types/formbricks-surveys";

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

export const renderSurvey = (props: SurveyContainerProps) => {
  // render SurveyNew
  // if survey type is link, we don't pass the placement, darkOverlay, clickOutside, onClose

  const { mode, containerId } = props;

  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });

  const apiClient = new ApiClient(props.apiHost, props.environmentId);

  if (mode === "inline") {
    if (!containerId) {
      throw new Error("renderSurvey: containerId is required for inline mode");
    }

    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
    }

    const { placement, darkOverlay, onClose, ...surveyInlineProps } = props;

    // render(h(SurveyInline, props), element);
    render(h(SurveyNew, surveyInlineProps), element);
  } else {
    const modalContainer = document.createElement("div");
    modalContainer.id = "formbricks-modal-container";
    document.body.appendChild(modalContainer);
    // render(h(SurveyModal, props), modalContainer);

    const enhancedProps: SurveyContainerProps = {
      ...props,
      onDisplay: async () => {
        try {
          const display = await apiClient.createDisplay(props.survey.id, props.userId);
          console.log("display created: ", display);

          if (props.onDisplayCreated) {
            console.log("about to call onDisplayCreated");

            props.onDisplayCreated(display.data.id);
          }
        } catch (err) {
          console.error("error creating display: ", err);
        }
      },
    };

    render(h(SurveyNew, enhancedProps), modalContainer);
  }
};

if (typeof window !== "undefined") {
  window.formbricksSurveys = {
    renderSurveyInline,
    renderSurveyModal,
    renderSurvey,
  };
}
