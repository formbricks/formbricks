import React, { useEffect, useMemo, useState } from "react";
import { Modal, ModalProps } from "react-native";
import { WebView } from "react-native-webview";
import { FormbricksAPI } from "@formbricks/api";
import { getLanguageCodeForSurvey } from "@formbricks/lib/i18n/utils";
import { RNAppConfig } from "@formbricks/lib/js/config";
import { sync } from "@formbricks/lib/js/sync";
import { Logger } from "@formbricks/lib/logger";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { getStyling } from "@formbricks/lib/utils/styling";
import { SurveyInlineProps } from "@formbricks/types/formbricksSurveys";
import { ZJsRNWebViewOnMessageData } from "@formbricks/types/js";
import { TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { SurveyStore } from "./lib/surveyStore";

const logger = Logger.getInstance();
const appConfig = RNAppConfig.getInstance();
const surveyStore = SurveyStore.getInstance();
let isSurveyRunning = false;

export const setIsSurveyRunning = (value: boolean) => {
  isSurveyRunning = value;
};

type SurveyWebViewProps = {
  survey: TSurvey;
} & ModalProps;

export const SurveyWebView = ({ survey, ...restProps }: SurveyWebViewProps) => {
  const [showSurvey, setShowSurvey] = useState(false);

  const product = appConfig.get().state.product;
  const attributes = appConfig.get().state.attributes;

  const styling = getStyling(product, survey);
  const isBrandingEnabled = product.inAppSurveyBranding;
  const isMultiLanguageSurvey = survey.languages.length > 1;
  let languageCode = "default";

  if (isMultiLanguageSurvey) {
    const displayLanguage = getLanguageCodeForSurvey(survey, attributes);
    //if survey is not available in selected language, survey wont be shown
    if (!displayLanguage) {
      logger.debug(`Survey "${survey.name}" is not available in specified language.`);
      setIsSurveyRunning(true);
      return;
    }
    languageCode = displayLanguage;
  }
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
          onResponseSendingFailed: () => {
            // setIsError(true);
          },
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

  const addResponseToQueue = (responseUpdate: TResponseUpdate) => {
    const { userId } = appConfig.get();
    if (userId) surveyState.updateUserId(userId);
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

  const createDisplay = async (survey: TSurvey) => {
    const { userId } = appConfig.get();

    const api = new FormbricksAPI({
      apiHost: appConfig.get().apiHost,
      environmentId: appConfig.get().environmentId,
    });
    const res = await api.client.display.create({
      surveyId: survey.id,
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
      visible={showSurvey && !isSurveyRunning}
      transparent={true}
      onRequestClose={() => {
        setShowSurvey(false);
      }}
      {...restProps}>
      <WebView
        originWhitelist={["*"]}
        source={{
          html: renderHtml({
            survey,
            isBrandingEnabled,
            styling,
            languageCode,
          }),
        }}
        style={{ backgroundColor: "transparent" }}
        contentMode="mobile"
        onShouldStartLoadWithRequest={(event) => {
          // prevent webview from redirecting if users taps on formbricks link.
          if (event.url.startsWith("https://formbricks")) {
            return false;
          } else {
            return true;
          }
        }}
        onMessage={async (event) => {
          const { data } = event.nativeEvent;
          const unvalidatedMessage = JSON.parse(data);

          // debugger
          if (unvalidatedMessage) {
            if (unvalidatedMessage.type === "Console") {
              console.info(`[Console] ${JSON.stringify(unvalidatedMessage.data)}`);
            } else {
              console.log(unvalidatedMessage);
            }
          }

          const validatedMessage = ZJsRNWebViewOnMessageData.safeParse(unvalidatedMessage);
          if (!validatedMessage.success) {
            logger.error("Error parsing message from WebView.");
            return;
          }
          // display
          const { onDisplay, onResponse, responseUpdate, onClose, onRetry, onFinished } =
            validatedMessage.data;
          if (onDisplay) {
            const { id } = await createDisplay(survey);
            surveyState.updateDisplayId(id);
          }
          if (onResponse && responseUpdate) {
            addResponseToQueue(responseUpdate);
          }
          if (onClose) {
            onCloseSurvey();
          }
          if (onRetry) {
            responseQueue.processQueue();
          }
          if (onFinished) {
            setTimeout(async () => {
              onCloseSurvey();
            }, 2500);
          }
        }}
      />
    </Modal>
  );
};

// todo: update ip to use from env.
const renderHtml = (options: Partial<SurveyInlineProps>) => {
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
