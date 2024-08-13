import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { getStyling } from "@formbricks/lib/utils/styling";
import { type SurveyInlineProps } from "@formbricks/types/formbricks-surveys";
import { ZJsRNWebViewOnMessageData } from "@formbricks/types/js";
import { type TResponseUpdate } from "@formbricks/types/responses";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { sync } from "../../js-core/src/app/lib/sync";
import { Logger } from "../../js-core/src/shared/logger";
import { getDefaultLanguageCode, getLanguageCode } from "../../js-core/src/shared/utils";
import { appConfig } from "./lib/config";
import { SurveyStore } from "./lib/survey-store";

const logger = Logger.getInstance();
logger.configure({ logLevel: "debug" });

const surveyStore = SurveyStore.getInstance();
let isSurveyRunning = false;

export const setIsSurveyRunning = (value: boolean): void => {
  isSurveyRunning = value;
};

interface SurveyWebViewProps {
  survey: TSurvey;
}

export function SurveyWebView({ survey }: SurveyWebViewProps): React.JSX.Element | undefined {
  const [showSurvey, setShowSurvey] = useState(false);

  const product = appConfig.get().state.product;
  const attributes = appConfig.get().state.attributes;

  const styling = getStyling(product, survey);
  const isBrandingEnabled = product.inAppSurveyBranding;
  const isMultiLanguageSurvey = survey.languages.length > 1;
  const [surveyState, setSurveyState] = useState(
    new SurveyState(survey.id, null, null, appConfig.get().userId)
  );

  const responseQueue = useMemo(
    () =>
      new ResponseQueue(
        {
          apiHost: appConfig.get().apiHost,
          environmentId: appConfig.get().environmentId,
          retryAttempts: 2,
          setSurveyState,
        },
        surveyState
      ),
    [surveyState]
  );

  useEffect(() => {
    if (survey.delay) {
      setTimeout(() => {
        setShowSurvey(true);
      }, survey.delay * 1000);
      return;
    }
    setShowSurvey(true);
  }, [survey.delay]);

  let languageCode = "default";

  if (isMultiLanguageSurvey) {
    const displayLanguage = getLanguageCode(survey, attributes);
    //if survey is not available in selected language, survey wont be shown
    if (!displayLanguage) {
      logger.debug(`Survey "${survey.name}" is not available in specified language.`);
      setIsSurveyRunning(true);
      return;
    }
    languageCode = displayLanguage;
  }

  const addResponseToQueue = (responseUpdate: TResponseUpdate): void => {
    const { userId } = appConfig.get();
    if (userId) surveyState.updateUserId(userId);
    responseQueue.updateSurveyState(surveyState);
    responseQueue.add({
      data: responseUpdate.data,
      ttc: responseUpdate.ttc,
      finished: responseUpdate.finished,
      language:
        responseUpdate.language === "default" ? getDefaultLanguageCode(survey) : responseUpdate.language,
    });
  };

  const onCloseSurvey = async (): Promise<void> => {
    await sync(
      {
        apiHost: appConfig.get().apiHost,
        environmentId: appConfig.get().environmentId,
        userId: appConfig.get().userId,
      },
      false,
      appConfig
    );
    surveyStore.resetSurvey();
    setShowSurvey(false);
  };

  const createDisplay = async (surveyId: string): Promise<{ id: string }> => {
    const { userId } = appConfig.get();

    const api = new FormbricksAPI({
      apiHost: appConfig.get().apiHost,
      environmentId: appConfig.get().environmentId,
    });
    const res = await api.client.display.create({
      surveyId,
      userId,
    });
    if (!res.ok) {
      throw new Error("Could not create display");
    }
    return res.data;
  };

  return (
    <Modal
      animationType="slide"
      visible={showSurvey ? !isSurveyRunning : undefined}
      transparent
      onRequestClose={() => {
        setShowSurvey(false);
      }}>
      <WebView
        originWhitelist={["*"]}
        source={{
          html: renderHtml({
            survey,
            isBrandingEnabled,
            styling,
            languageCode,
            apiHost: appConfig.get().apiHost,
          }),
        }}
        style={{ backgroundColor: "transparent" }}
        contentMode="mobile"
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        mixedContentMode="always"
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        onShouldStartLoadWithRequest={(event) => {
          // prevent webview from redirecting if users taps on formbricks link.
          if (event.url.startsWith("https://formbricks")) {
            return false;
          }
          return true;
        }}
        onMessage={async (event: WebViewMessageEvent) => {
          try {
            const { data } = event.nativeEvent;
            const unvalidatedMessage: unknown = JSON.parse(data);

            if (typeof unvalidatedMessage === "object" && unvalidatedMessage !== null) {
              const messageObj = unvalidatedMessage as { type?: string; data?: unknown };
              if (messageObj.type === "Console" && messageObj.data) {
                logger.debug(`[Console] ${JSON.stringify(messageObj.data)}`);
              }
            }

            const validatedMessage = ZJsRNWebViewOnMessageData.safeParse(unvalidatedMessage);
            if (!validatedMessage.success) {
              logger.error("Error parsing message from WebView.");
              return;
            }

            // Destructure the validated data
            const { onDisplay, onResponse, responseUpdate, onClose, onRetry, onFinished } =
              validatedMessage.data;

            if (onDisplay) {
              const { id } = await createDisplay(survey.id);
              surveyState.updateDisplayId(id);
            }
            if (onResponse && responseUpdate) {
              addResponseToQueue(responseUpdate);
            }
            if (onClose) {
              await onCloseSurvey();
            }
            if (onRetry) {
              await responseQueue.processQueue();
            }
            if (onFinished) {
              setTimeout(() => {
                void (async () => {
                  await onCloseSurvey();
                })();
              }, 2500);
            }
          } catch (error) {
            logger.error("Error handling WebView message");
          }
        }}
      />
    </Modal>
  );
}

const renderHtml = (options: Partial<SurveyInlineProps> & { apiHost?: string }): string => {
  return `
  <!doctype html>
  <html>
    <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
    <head>
      <title>Formbricks WebView Survey</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body style="overflow: hidden; height: 100vh; display: flex; flex-direction: column; justify-content: flex-end;">
    <div id="formbricks-react-native" style="width: 100%;"></div>
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

      function onClose() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onClose: true }));
      };

      function onFinished() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onFinished: true }));
      };

      function onDisplay() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onDisplay: true }));
      };

      function onResponse(responseUpdate) {
        console.log(JSON.stringify({ onResponse: true, responseUpdate }));
        window.ReactNativeWebView.postMessage(JSON.stringify({ onResponse: true, responseUpdate }));
      };

      function onRetry(responseUpdate) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onRetry: true }));
      };

      function loadSurvey() {
        const options = ${JSON.stringify(options)};
        const containerId = "formbricks-react-native";
        const surveyProps = {
          ...options,
          containerId,
          onFinished,
          onDisplay,
          onResponse,
          onRetry,
          onClose,
        };
        window.formbricksSurveys.renderSurveyInline(surveyProps);
      }

      const script = document.createElement("script");
      script.src = "http://localhost:3000/api/packages/surveys";
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
