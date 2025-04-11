import { SurveyWebView } from "@/components/survey-web-view";
import { Logger } from "@/lib/common/logger";
import { setup } from "@/lib/common/setup";
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
    const setupFormbricks = async (): Promise<void> => {
      try {
        await setup({
          environmentId,
          appUrl,
        });
      } catch {
        logger.debug("Initialization failed");
      }
    };

    setupFormbricks().catch(() => {
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
