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
      onDisplay: () => {
        console.log("onDisplay");
      },
      onResponse: (response) => {
        console.log("onResponse:", JSON.stringify(response, null, 2));
      },
      onClose: () => {
        console.log("onClose");
      },
    });
  });
  return <div id="formbricks-survey"></div>;
};
