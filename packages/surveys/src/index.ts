import { RenderSurvey } from "@/components/general/render-survey";
import { I18nProvider } from "@/components/i18n/provider";
import { FILE_PICK_EVENT } from "@/lib/constants";
import { getI18nLanguage } from "@/lib/i18n-utils";
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

  const { mode, containerId, languageCode } = props;

  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });

  const language = getI18nLanguage(languageCode, props.survey.languages);

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
      h(
        I18nProvider,
        { language },
        h(RenderSurvey, {
          ...surveyInlineProps,
        })
      ),
      element
    );
  } else {
    const modalContainer = document.createElement("div");
    modalContainer.id = "formbricks-modal-container";
    document.body.appendChild(modalContainer);

    render(
      h(
        I18nProvider,
        { language },
        h(RenderSurvey, {
          ...props,
        })
      ),
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
