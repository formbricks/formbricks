import { TResponse } from "@formbricks/types/v1/responses";
import { h, render } from "preact";
import { TSurvey } from "../../types/v1/surveys";
import { Survey } from "./components/Survey";
import { addStylesToDom } from "./lib/styles";
import { SurveyModal } from "./components/SurveyModal";

interface BaseProps {
  survey: TSurvey;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: Partial<TResponse>) => void;
  onClose?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  autoFocus?: boolean;
}

interface RenderSurveyInlineProps extends BaseProps {
  containerId: string;
}

interface RenderSurveyModalProps extends BaseProps {
  clickOutside: boolean;
  darkOverlay: boolean;
  highlightBorderColor: string | null;
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
}

interface RenderSurveyModalInlineProps extends RenderSurveyModalProps, RenderSurveyInlineProps {}

export const renderSurveyInline = (props: RenderSurveyInlineProps) => {
  addStylesToDom();
  const { containerId, ...surveyProps } = props;
  const element = document.getElementById(containerId);
  if (!element) {
    throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
  }
  render(h(Survey, surveyProps), element);
};

export const renderSurveyModal = (props: RenderSurveyModalProps) => {
  addStylesToDom();
  // add container element to DOM
  const element = document.createElement("div");
  element.id = "formbricks-modal-container";
  document.body.appendChild(element);
  render(h(SurveyModal, props), element);
};

export const renderSurveyModalInline = (props: RenderSurveyModalInlineProps) => {
  addStylesToDom();
  // add container element to DOM
  const { containerId, ...surveyProps } = props;
  const element = document.getElementById(containerId);
  if (!element) {
    throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
  }
  render(h(SurveyModal, surveyProps), element);
};
