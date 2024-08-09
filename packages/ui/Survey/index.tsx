import { useCallback, useEffect, useMemo } from "react";
import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricks-surveys";
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

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length && props.setIsSurveyLoaded) {
          props.setIsSurveyLoaded(true);
          observer.disconnect();
        }
      });
    });

    const targetNode = document.getElementById(containerId);
    if (targetNode) {
      observer.observe(targetNode, { childList: true });
    }

    return () => {
      if (targetNode) {
        observer.disconnect();
      }
    };
  }, [containerId]);

  return <div id={containerId} className="h-full w-full" />;
};
