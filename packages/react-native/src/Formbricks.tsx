import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { Logger } from "@formbricks/lib/logger";
import { TJsAppConfigInput } from "@formbricks/types/js";
import { SurveyWebView } from "./SurveyWebView";
import { init } from "./lib";
import { SurveyStore } from "./lib/surveyStore";

type FormbricksProps = {
  initializationConfig: TJsAppConfigInput;
};
const logger = Logger.getInstance();

const surveyStore = SurveyStore.getInstance();

export const Formbricks = ({ initializationConfig }: FormbricksProps) => {
  // initializes sdk
  useEffect(() => {
    init({
      environmentId: initializationConfig.environmentId,
      apiHost: initializationConfig.apiHost,
      userId: initializationConfig.userId,
      attributes: initializationConfig.attributes,
    });
  }, [initializationConfig]);

  const subscribe = useCallback((callback: () => void) => {
    const unsubscribe = surveyStore.subscribe(callback);
    return unsubscribe;
  }, []);

  const getSnapshot = useCallback(() => surveyStore.getSurvey(), []);
  const survey = useSyncExternalStore(subscribe, getSnapshot);
  logger.debug("survey" + survey);
  return survey ? <SurveyWebView survey={survey} /> : <></>;
};
