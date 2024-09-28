import { useCallback, useEffect, useMemo, useState } from "react";
import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricks-surveys";

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
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  const loadSurveyScript: () => Promise<void> = async () => {
    try {
      const response = await fetch("/api/packages/surveys");

      if (!response.ok) {
        throw new Error("Failed to load the surveys package");
      }

      const scriptContent = await response.text();
      const scriptElement = document.createElement("script");

      scriptElement.textContent = scriptContent;

      document.head.appendChild(scriptElement);
      setIsScriptLoaded(true);
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    const loadScript = async () => {
      if (!window.formbricksSurveys) {
        try {
          await loadSurveyScript();
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
    if (isScriptLoaded) {
      renderInline();
    }
  }, [isScriptLoaded, renderInline]);

  return <div id={containerId} className="h-full w-full" />;
};
