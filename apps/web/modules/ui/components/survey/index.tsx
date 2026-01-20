"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { executeRecaptcha, loadRecaptchaScript } from "@/modules/ui/components/survey/recaptcha";

const createContainerId = () => `formbricks-survey-container`;

// Module-level flag to prevent concurrent script loads across component instances
let isLoadingScript = false;

declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyContainerProps) => void;
      renderSurveyModal: (props: SurveyContainerProps) => void;
      renderSurvey: (props: SurveyContainerProps) => void;
      onFilePick: (files: { name: string; type: string; base64: string }[]) => void;
      setNonce: (nonce: string | undefined) => void;
    };
  }
}

export const SurveyInline = (props: Omit<SurveyContainerProps, "containerId">) => {
  const containerId = useMemo(() => createContainerId(), []);
  const getRecaptchaToken = useCallback(
    () => executeRecaptcha(props.recaptchaSiteKey),
    [props.recaptchaSiteKey]
  );

  const renderInline = useCallback(
    () => window.formbricksSurveys.renderSurvey({ ...props, containerId, getRecaptchaToken, mode: "inline" }),
    [containerId, props, getRecaptchaToken]
  );
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadSurveyScript: () => Promise<void> = async () => {
    // Set loading flag immediately to prevent concurrent loads
    isLoadingScript = true;
    try {
      const scriptUrl = props.appUrl ? `${props.appUrl}/js/surveys.umd.cjs` : "/js/surveys.umd.cjs";
      const response = await fetch(scriptUrl);

      if (!response.ok) {
        throw new Error("Failed to load the surveys package");
      }

      const scriptContent = await response.text();
      const scriptElement = document.createElement("script");

      scriptElement.textContent = scriptContent;

      document.head.appendChild(scriptElement);
      setIsScriptLoaded(true);
      hasLoadedRef.current = true;
    } catch (error) {
      throw error;
    } finally {
      isLoadingScript = false;
    }
  };

  useEffect(() => {
    // Prevent duplicate loads across multiple renders or component instances
    if (hasLoadedRef.current || isLoadingScript) {
      return;
    }

    const loadScript = async () => {
      if (!window.formbricksSurveys) {
        try {
          if (props.isSpamProtectionEnabled && props.recaptchaSiteKey) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);

  useEffect(() => {
    if (isScriptLoaded) {
      renderInline();
    }
  }, [isScriptLoaded, renderInline]);

  return <div id={containerId} className="h-full w-full" />;
};
