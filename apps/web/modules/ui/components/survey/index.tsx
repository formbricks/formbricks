import { executeRecaptcha, loadRecaptchaScript } from "@/modules/ui/components/survey/recaptcha";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const getRecaptchaToken = useCallback(async () => {
    return executeRecaptcha(props.recaptchaSiteKey);
  }, [props.recaptchaSiteKey]);

  const renderInline = useCallback(
    () => window.formbricksSurveys.renderSurvey({ ...props, containerId, getRecaptchaToken, mode: "inline" }),
    [containerId, props]
  );
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  const loadSurveyScript: () => Promise<void> = async () => {
    try {
      const response = await fetch("/js/surveys.umd.cjs");

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
          if (props.isSpamProtectionEnabled) {
            await loadRecaptchaScript(props.recaptchaSiteKey);
          }
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
