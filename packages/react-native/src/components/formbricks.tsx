import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { init } from "../common/initialize";
import { Logger } from "../common/logger";
import { SurveyStore } from "../survey/survey-store";
import { SurveyWebView } from "./survey-web-view";

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
      } catch {
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
