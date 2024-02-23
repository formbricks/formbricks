import React, { useMemo, useState } from "react";
import { Button, View } from "react-native";
import { WebView } from "react-native-webview";

import { ResponseQueue } from "@formbricks/lib/responseQueue";
import SurveyState from "@formbricks/lib/surveyState";
import { TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

import { createDisplay } from "./lib/api";
import { Config } from "./lib/config";
import { SurveyStore } from "./lib/surveyStore";
import { sync } from "./lib/sync";

type SurveyWebViewProps = {
  survey: TSurvey;
};

const config = Config.getInstance();
const surveyStore = SurveyStore.getInstance();

export const SurveyWebView = ({ survey }: SurveyWebViewProps) => {
  const product = config.get().state.product;
  const productOverwrites = survey.productOverwrites ?? {};
  const brandColor = productOverwrites.brandColor ?? product.brandColor;
  const isBrandingEnabled = product.inAppSurveyBranding;

  const [surveyState, setSurveyState] = useState(new SurveyState(survey.id, null, null, config.get().userId));

  const responseQueue = useMemo(
    () =>
      new ResponseQueue(
        {
          apiHost: config.get().apiHost,
          environmentId: config.get().environmentId,
          retryAttempts: 2,
          onResponseSendingFailed: () => {
            // setIsError(true);
          },
          setSurveyState,
        },
        surveyState
      ),
    [surveyState]
  );

  const addResponseToQueue = (responseUpdate: TResponseUpdate) => {
    const { userId } = config.get();
    surveyState.updateUserId(userId);
    responseQueue.updateSurveyState(surveyState);
    responseQueue.add({
      data: responseUpdate.data,
      ttc: responseUpdate.ttc,
      finished: responseUpdate.finished,
    });
  };

  const onCloseSurvey = async () => {
    await sync(
      {
        apiHost: config.get().apiHost,
        environmentId: config.get().environmentId,
        userId: config.get().userId,
      },
      true
    );
    surveyStore.resetSurvey();
  };

  return survey ? (
    <View
      style={{
        position: "absolute",
        height: "100%",
        width: "100%",
        zIndex: 9999,
      }}>
      <Button title="Close" onPress={onCloseSurvey} />
      <WebView
        originWhitelist={["*"]}
        source={{ html: renderHtml(survey, isBrandingEnabled, brandColor) }}
        style={{ flex: 1 }}
        contentMode="mobile"
        onMessage={async (event) => {
          const { data } = event.nativeEvent;
          const parsedData = JSON.parse(data);

          // debug
          if (parsedData) {
            if (parsedData.type === "Console") {
              console.info(`[Console] ${JSON.stringify(parsedData.data)}`);
            } else {
              console.log(parsedData);
            }
          }

          // display
          try {
            const { onDisplay } = parsedData;
            if (onDisplay) {
              const display = await createDisplay(survey);
              console.log({ display });
            }
          } catch (error) {
            // handle error
          }

          // response
          try {
            const { responseUpdate } = parsedData;
            if (responseUpdate) {
              addResponseToQueue(responseUpdate);
            }
          } catch (error) {
            // handle error
          }

          // closed
          try {
            const { onClose } = parsedData;
            if (onClose) {
              onCloseSurvey();
            }
          } catch (error) {
            // handle error
          }

          // finished
          try {
            const { onFinished } = parsedData;
            if (onFinished) {
              setTimeout(async () => {
                onCloseSurvey();
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

const renderHtml = (survey: TSurvey, isBrandingEnabled: boolean, brandColor: string) => {
  return `
  <!doctype html>
  <html>
    <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
    <head>
      <title></title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body>
      <div style="height: 100%; width: 100%; padding: 0% 10%;">
        <div style="margin-top: 30vh;" id="formbricks-react-native" />
      </div>
    </body>
    <script type="text/javascript">
    const consoleLog = (type, log) => window.ReactNativeWebView.postMessage(JSON.stringify({'type': 'Console', 'data': {'type': type, 'log': log}}));
    console = {
        log: (log) => consoleLog('log', log),
        debug: (log) => consoleLog('debug', log),
        info: (log) => consoleLog('info', log),
        warn: (log) => consoleLog('warn', log),
        error: (log) => consoleLog('error', log),
      };

      function onFinished() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onFinished: true }));
      };

      function onDisplay() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onDisplay: true }));
      };

      function onResponse(responseUpdate) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ responseUpdate }));
      };

      function loadSurvey() {
        const survey = ${JSON.stringify(survey)};
        const isBrandingEnabled = "${isBrandingEnabled}";
        const brandColor = "${brandColor}";
        const containerId = "formbricks-react-native";
        const surveyProps = {
          survey,
          isBrandingEnabled,
          brandColor,
          containerId,
          onFinished,
          onDisplay,
          onResponse,
        };
        window.formbricksSurveys.renderSurveyInline(surveyProps);
      }

      const script = document.createElement("script");
      script.src = "http://192.168.4.30:3003/index.umd.js";
      script.async = true;
      script.onload = () => loadSurvey();
      script.onerror = (error) => {
        console.error("Failed to load Formbricks Surveys library:", error);
      };
      document.head.appendChild(script);
    </script>
  </html>
  `;
};
