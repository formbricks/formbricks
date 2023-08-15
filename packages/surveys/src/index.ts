import { TResponse } from "@formbricks/types/v1/responses";
import { h, render } from "preact";
import { TSurvey } from "../../types/v1/surveys";
import { Survey } from "./components/Survey";
import { addStylesToDom } from "./lib/styles";

interface RenderSurveyProps {
  containerId: string;
  survey: TSurvey;
  brandColor: string;
  formbricksSignature: boolean;
  onDisplay?: () => void;
  onResponse?: (response: Partial<TResponse>) => void;
  onClose?: () => void;
}

export const renderSurvey = (props: RenderSurveyProps) => {
  addStylesToDom();
  const { containerId, ...surveyProps } = props;
  const element = document.getElementById(containerId);
  if (!element) {
    throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
  }
  render(h(Survey, surveyProps), element);
};
