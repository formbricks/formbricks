import { useEffect, useMemo } from "react";

import { renderSurveyInline, renderSurveyModal } from "@formbricks/surveys";
import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricksSurveys";

const createContainerId = () => `formbricks-survey-container`;

export const SurveyInline = (props: Omit<SurveyInlineProps, "containerId">) => {
  const containerId = useMemo(() => createContainerId(), []);
  useEffect(() => {
    renderSurveyInline({
      ...props,
      containerId,
    });
  }, [containerId, props]);
  return <div id={containerId} className="h-full w-full" />;
};

export const SurveyModal = (props: SurveyModalProps) => {
  useEffect(() => {
    renderSurveyModal(props);
  }, [props]);
  return <div id="formbricks-survey"></div>;
};
