import { SurveyWebView } from "@/components/survey-web-view";
import { init } from "@/lib/common/initialize";
import { Logger } from "@/lib/common/logger";
import { SurveyStore } from "@/lib/survey/store";
import React, { useCallback, useEffect, useSyncExternalStore } from "react";

interface FormbricksProps {
  appUrl: string;
  environmentId: string;
}

const surveyStore = SurveyStore.getInstance();
const logger = Logger.getInstance();

export function Formbricks({ appUrl, environmentId }: FormbricksProps): React.JSX.Element | null {
  // initializes sdk
  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        await init({
          environmentId,
          appUrl,
        });
      } catch (e) {
        // eslint-disable-next-line no-console -- logging is allowed in demo apps
        console.log("Error aa gayi betichod: ", e);

        logger.debug("Initialization failed");
      }
    };

    initialize().catch(() => {
      logger.debug("Initialization error");
    });
  }, [environmentId, appUrl]);

  const subscribe = useCallback((callback: () => void) => {
    const unsubscribe = surveyStore.subscribe(callback);
    return unsubscribe;
  }, []);

  const getSnapshot = useCallback(() => surveyStore.getSurvey(), []);
  const survey = useSyncExternalStore(subscribe, getSnapshot);

  return survey ? <SurveyWebView survey={survey} /> : null;
}
