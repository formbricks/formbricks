import { useCallback, useEffect, useMemo } from "react";

import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricksSurveys";

import { loadSurveyScript } from "./lib/loadScript";

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
  const renderInline = useCallback(
    () => window.formbricksSurveys.renderSurveyInline({ ...props, containerId }),
    [containerId, props]
  );

  useEffect(() => {
    const loadScript = async () => {
      if (!window.formbricksSurveys) {
        try {
          await loadSurveyScript();
          renderInline();
        } catch (error) {
          console.error("Failed to load the surveys package: ", error);
        }
      } else {
        renderInline();
      }
    };

    loadScript();
  }, [containerId, props, renderInline]);

  return <div id={containerId} className="h-full w-full" />;
};
