import { h, render } from "preact";
import Survey from "./Survey";

interface RenderSurveyProps {
  containerId: string;
  brandColor: string;
  formbricksSignature: boolean;
  onDisplay?: () => void;
  onResponse?: () => void;
}

export const renderSurvey = (props: RenderSurveyProps) => {
  const { containerId, ...surveyProps } = props;
  const element = document.getElementById(containerId);
  if (!element) {
    throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
  }
  render(h(Survey, surveyProps), element);
};
