import { renderSurvey } from "@formbricks/surveys";
import { Survey } from "@formbricks/types/surveys";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useEffect } from "react";

interface SurveyProps {
  survey: TSurvey | Survey;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: Partial<TResponse>) => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onClose?: () => void;
}

export const SurveyView = ({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  onDisplay = () => {},
  onResponse = () => {},
  onActiveQuestionChange = () => {},
  onClose = () => {},
}: SurveyProps) => {
  useEffect(() => {
    renderSurvey({
      survey,
      brandColor,
      formbricksSignature,
      containerId: "formbricks-survey",
      onDisplay,
      onResponse,
      onClose,
      activeQuestionId,
      onActiveQuestionChange,
    });
  });
  return <div id="formbricks-survey"></div>;
};
