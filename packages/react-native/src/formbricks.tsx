import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { type TJsAppConfigInput } from "@formbricks/types/js";
import { Logger } from "../../js-core/src/shared/logger";
import { init } from "./lib";
import { SurveyStore } from "./lib/survey-store";
import { SurveyWebView } from "./survey-web-view";

interface FormbricksProps {
  initConfig: TJsAppConfigInput;
}
const surveyStore = SurveyStore.getInstance();
const logger = Logger.getInstance();

export function Formbricks({ initConfig }: FormbricksProps): React.JSX.Element | null {
  // initializes sdk
  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        await init({
          environmentId: initConfig.environmentId,
          apiHost: initConfig.apiHost,
          userId: initConfig.userId,
          attributes: initConfig.attributes,
        });
      } catch (error) {
        logger.debug("Initialization failed");
      }
    };

    initialize().catch(() => {
      logger.debug("Initialization error");
    });
  }, [initConfig]);

  const subscribe = useCallback((callback: () => void) => {
    const unsubscribe = surveyStore.subscribe(callback);
    return unsubscribe;
  }, []);

  const getSnapshot = useCallback(() => surveyStore.getSurvey(), []);
  const survey = useSyncExternalStore(subscribe, getSnapshot);

  return survey ? <SurveyWebView survey={survey} /> : null;
}
