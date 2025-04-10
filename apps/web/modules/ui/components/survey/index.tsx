import { useMemo } from "react";
import RenderSurvey from "@formbricks/surveys/";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";

const createContainerId = () => `formbricks-survey-container`;
declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyContainerProps) => void;
      renderSurveyModal: (props: SurveyContainerProps) => void;
      renderSurvey: (props: SurveyContainerProps) => void;
      onFilePick: (files: { name: string; type: string; base64: string }[]) => void;
    };
  }
}

export const SurveyInline = (props: Omit<SurveyContainerProps, "containerId">) => {
  const containerId = useMemo(() => createContainerId(), []);
  return (
    <div id={containerId} className="h-full w-full">
      <RenderSurvey {...props} />
    </div>
  );
};
