import { h, render } from "preact";
import { Survey } from "./components/Survey";
import { TSurvey } from "../../types/v1/surveys";

interface RenderSurveyProps {
  containerId: string;
  survey: TSurvey;
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
