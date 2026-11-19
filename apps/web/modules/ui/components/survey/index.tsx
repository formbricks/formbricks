"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { IS_DEVELOPMENT_BUILD } from "@/lib/env-client";
import {
  SurveysRendererNotInstalledError,
  isSurveysRendererReady,
  loadSurveysScript,
} from "@/modules/ui/components/survey/load-surveys-script";
import { executeRecaptcha, loadRecaptchaScript } from "@/modules/ui/components/survey/recaptcha";
import { getSurveysScriptUrl } from "@/modules/ui/components/survey/script-url";

const createContainerId = () => `formbricks-survey-container`;

// Module-level flag to prevent concurrent script loads across component instances
let isLoadingScript = false;

// `window.formbricksSurveys` is typed once, in packages/types/surveys.d.ts. A second declaration here
// had drifted from it (no `setAppearance`), which TypeScript rejects as a conflicting redeclaration.

type TSurveyInlineProps = Omit<SurveyContainerProps, "containerId"> & {
  /** The app's release version, which the renderer is loaded under (see `getSurveysScriptUrl`). */
  readonly rendererVersion?: string;
};

export const SurveyInline = (props: TSurveyInlineProps) => {
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
  const [rendererError, setRendererError] = useState<SurveysRendererNotInstalledError | null>(null);
  const hasLoadedRef = useRef(false);

  const loadRendererAndMarkLoaded: () => Promise<void> = async () => {
    // Set loading flag immediately to prevent concurrent loads
    isLoadingScript = true;
    try {
      const scriptUrl = getSurveysScriptUrl(props.appUrl, props.rendererVersion);
      await loadSurveysScript(scriptUrl, IS_DEVELOPMENT_BUILD ? { cache: "no-store" } : {});
      setIsScriptLoaded(true);
      hasLoadedRef.current = true;
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
      if (!isSurveysRendererReady()) {
        try {
          if (props.isSpamProtectionEnabled && props.recaptchaSiteKey) {
            await loadRecaptchaScript(props.recaptchaSiteKey);
          }
          await loadRendererAndMarkLoaded();
        } catch (error) {
          console.error("Failed to load the surveys package: ", error);
          // No renderer after every attempt: hand it to the nearest error boundary (the link survey's
          // "try again" screen) rather than leave an empty container. A failed request stays logged only.
          if (error instanceof SurveysRendererNotInstalledError) {
            setRendererError(error);
          }
        }
      } else {
        renderInline();
      }
    };

    void loadScript();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time script load guarded by hasLoadedRef; depending on loadRendererAndMarkLoaded/renderInline would re-trigger the load
  }, [props]);

  useEffect(() => {
    if (isScriptLoaded) {
      renderInline();
    }
  }, [isScriptLoaded, renderInline]);

  if (rendererError) {
    throw rendererError;
  }

  return <div id={containerId} className="h-full w-full" />;
};
