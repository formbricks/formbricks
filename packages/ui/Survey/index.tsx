import { useEffect, useMemo } from "react";

import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricksSurveys";

import { loadSurveyScript } from "./loadScript";

const createContainerId = () => `formbricks-survey-container`;
declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyInlineProps) => void;
      renderSurveyModal: (props: SurveyModalProps) => void;
    };
  }
}

export const SurveyInline = (props: Omit<SurveyInlineProps, "containerId">) => {
  const containerId = useMemo(() => createContainerId(), []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const renderInline = () => window.formbricksSurveys.renderSurveyInline({ ...props, containerId });
      if (!window.formbricksSurveys) {
        loadSurveyScript().then(renderInline);
      } else {
        renderInline();
      }
    }
  }, [containerId, props]);
  return <div id={containerId} className="h-full w-full" />;
};

export const SurveyModal = (props: SurveyModalProps) => {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const renderModal = () => window.formbricksSurveys.renderSurveyModal(props);
      if (!window.formbricksSurveys) {
        loadSurveyScript().then(renderModal);
      } else {
        renderModal();
      }
    }
  }, [props]);
  return <div id="formbricks-survey"></div>;
};
