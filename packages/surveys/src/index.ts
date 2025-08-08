import { RenderSurvey } from "@/components/general/render-survey";
import { FILE_PICK_EVENT } from "@/lib/constants";
import { addCustomThemeToDom, addStylesToDom } from "@/lib/styles";
import { isRTL } from "@/lib/utils";
import { h, render } from "preact";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";

const checkIfSurveyIsRTL = (survey: TJsEnvironmentStateSurvey, languageCode: string): boolean => {
  if (survey.welcomeCard.enabled) {
    const welcomeCardHeadline = survey.welcomeCard.headline?.[languageCode];
    if (welcomeCardHeadline) {
      return isRTL(welcomeCardHeadline);
    }

    return false;
  }

  for (const question of survey.questions) {
    const questionHeadline = question.headline[languageCode];

    // the first non-empty question headline is the survey direction
    if (questionHeadline) {
      return isRTL(questionHeadline);
    }
  }

  return false;
};

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

  const isSurveyRTL = checkIfSurveyIsRTL(props.survey, props.languageCode);

  if (mode === "inline") {
    if (!containerId) {
      throw new Error("renderSurvey: containerId is required for inline mode");
    }

    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
    }

    const { placement, darkOverlay, onClose, clickOutside, ...surveyInlineProps } = props;

    render(
      h(RenderSurvey, {
        ...surveyInlineProps,
        dir: isSurveyRTL ? "rtl" : "auto",
      }),
      element
    );
  } else {
    const modalContainer = document.createElement("div");
    modalContainer.id = "formbricks-modal-container";
    document.body.appendChild(modalContainer);

    render(
      h(RenderSurvey, {
        ...props,
        dir: isSurveyRTL ? "rtl" : "auto",
      }),
      modalContainer
    );
  }
};

export const renderSurveyModal = renderSurvey;

export const onFilePick = (files: { name: string; type: string; base64: string }[]) => {
  const fileUploadEvent = new CustomEvent(FILE_PICK_EVENT, { detail: files });
  window.dispatchEvent(fileUploadEvent);
};

// Initialize the global formbricksSurveys object if it doesn't exist
if (typeof window !== "undefined") {
  window.formbricksSurveys = {
    renderSurveyInline,
    renderSurveyModal,
    renderSurvey,
    onFilePick,
  };
}
