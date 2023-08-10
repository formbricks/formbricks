import { renderSurvey } from "@formbricks/surveys";
import { Survey } from "@formbricks/types/surveys";
import { useEffect } from "react";

interface SurveyProps {
  survey: Survey;
  brandColor: string;
  formbricksSignature: boolean;
}

export const SurveyView = ({ survey }: SurveyProps) => {
  useEffect(() => {
    renderSurvey({
      survey,
      brandColor: "#000",
      formbricksSignature: true,
      containerId: "formbricks-survey",
    });
  });
  return <div id="formbricks-survey"></div>;
};
