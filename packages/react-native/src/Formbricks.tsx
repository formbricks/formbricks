import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { TJsAppConfigInput } from "@formbricks/types/js";
import { SurveyWebView } from "./SurveyWebView";
import { init } from "./lib";
import { SurveyStore } from "./lib/surveyStore";

interface FormbricksProps {
  initConfig: TJsAppConfigInput;
}
const surveyStore = SurveyStore.getInstance();

export const Formbricks = ({ initConfig }: FormbricksProps) => {
  // initializes sdk
  useEffect(() => {
    init({
      environmentId: initConfig.environmentId,
      apiHost: initConfig.apiHost,
      userId: initConfig.userId,
      attributes: initConfig.attributes,
    });
  }, [initConfig]);

  const subscribe = useCallback((callback: () => void) => {
    const unsubscribe = surveyStore.subscribe(callback);
    return unsubscribe;
  }, []);

  const getSnapshot = useCallback(() => surveyStore.getSurvey(), []);
  const survey = useSyncExternalStore(subscribe, getSnapshot);
  return survey ? <SurveyWebView survey={survey} /> : <></>;
};
