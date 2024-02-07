import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { TRNConfigInput } from "@formbricks/types/react-native";

import { init } from "./lib";
import { Config } from "./lib/config";
import { SurveyStore } from "./lib/surveyStore";
import { sync } from "./lib/sync";

type FormbricksProps = {
  initializationConfig: TRNConfigInput;
};

const surveyStore = SurveyStore.getInstance();
const config = Config.getInstance();

export const Formbricks = ({ initializationConfig }: FormbricksProps) => {
  // initializes sdk
  useEffect(() => {
    init({
      environmentId: initializationConfig.environmentId,
      apiHost: initializationConfig.apiHost,
      debug: initializationConfig.debug,
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

  return survey ? (
    <View
      style={{
        position: "absolute",
        height: "100%",
        width: "100%",
        zIndex: 9999,
      }}>
      <WebView
        source={{
          uri: `http://localhost:3000/s/${survey.id}?mobile=true&userId=${initializationConfig.userId}`,
        }}
        style={{ flex: 1 }}
        contentMode="mobile"
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as {
              closeModal: boolean;
            };

            if (data.closeModal) {
              setTimeout(async () => {
                await sync({
                  apiHost: config.get().apiHost,
                  environmentId: config.get().environmentId,
                  userId: config.get().userId,
                });
                surveyStore.resetSurvey();
              }, 2500);
            }
          } catch (error) {
            // handle error
          }
        }}
      />
    </View>
  ) : (
    <></>
  );
};
