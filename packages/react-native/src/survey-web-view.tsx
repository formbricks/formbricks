/* eslint-disable @typescript-eslint/no-unsafe-call -- required */

/* eslint-disable no-console -- debugging*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { getStyling } from "@formbricks/lib/utils/styling";
import type { SurveyInlineProps } from "@formbricks/types/formbricks-surveys";
import { ZJsRNWebViewOnMessageData } from "@formbricks/types/js";
import type { TJsFileUploadParams } from "@formbricks/types/js";
import type { TResponseUpdate } from "@formbricks/types/responses";
import type { TUploadFileConfig } from "@formbricks/types/storage";
import type { TSurvey } from "@formbricks/types/surveys/types";
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

export function SurveyWebView({ survey }: SurveyWebViewProps): JSX.Element | undefined {
  const webViewRef = useRef(null);
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

  const uploadFile = async (
    file: TJsFileUploadParams["file"],
    params?: TUploadFileConfig
  ): Promise<string> => {
    const api = new FormbricksAPI({
      apiHost: appConfig.get().apiHost,
      environmentId: appConfig.get().environmentId,
    });

    return await api.client.storage.uploadFile(file, params);
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
        ref={webViewRef}
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
            const unvalidatedMessage = JSON.parse(data) as { type: string; data: unknown };

            // debugger
            if (unvalidatedMessage.type === "Console") {
              console.info(`[Console] ${JSON.stringify(unvalidatedMessage.data)}`);
            }

            const validatedMessage = ZJsRNWebViewOnMessageData.safeParse(unvalidatedMessage);
            if (!validatedMessage.success) {
              logger.error("Error parsing message from WebView.");
              return;
            }
            // display
            const {
              onDisplay,
              onResponse,
              responseUpdate,
              onClose,
              onRetry,
              onFinished,
              onFileUpload,
              fileUploadParams,
              uploadId,
            } = validatedMessage.data;
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
            if (onFileUpload && fileUploadParams) {
              const fileType = fileUploadParams.file.type;
              const fileName = fileUploadParams.file.name;
              const fileDataUri = fileUploadParams.file.base64;

              if (fileDataUri) {
                const file: TJsFileUploadParams["file"] = {
                  // uri: Platform.OS === "android" ? `data:${fileType};base64,${base64Data}` : base64Data,
                  base64: fileUploadParams.file.base64,
                  type: fileType,
                  name: fileName,
                };

                try {
                  const fileUploadResult = await uploadFile(file, fileUploadParams.params);

                  if (fileUploadResult) {
                    // @ts-expect-error -- injectJavaScript is not typed

                    webViewRef.current?.injectJavaScript(`
                    window.onFileUploadComplete(${JSON.stringify({
                      success: true,
                      url: fileUploadResult,
                      uploadId,
                    })});
                  `);
                  } else {
                    // @ts-expect-error -- injectJavaScript is not typed

                    webViewRef.current?.injectJavaScript(`
                    window.onFileUploadComplete(${JSON.stringify({
                      success: false,
                      error: "File upload failed",
                      uploadId,
                    })});
                  `);
                  }
                } catch (error) {
                  console.error("Error in file upload: ", error);
                }
              }
            }
          } catch (error) {
            logger.error(`Error handling WebView message: ${error as string}`);
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


      window.fileUploadPromiseCallbacks = new Map();

      function onFileUpload(file, params) {
        return new Promise((resolve, reject) => {
          const uploadId = Date.now() + '-' + Math.random(); // Generate a unique ID for this upload

          window.ReactNativeWebView.postMessage(JSON.stringify({ onFileUpload: true, uploadId, fileUploadParams: { file, params } }));

          const promiseResolve = (url) => {
            resolve(url);
          }

          const promiseReject = (error) => {
            reject(error);
          }
          
          window.fileUploadPromiseCallbacks.set(uploadId, { resolve: promiseResolve, reject: promiseReject });
        });
      }
      
      // Add this function to handle the upload completion
      function onFileUploadComplete(result) {
        if (window.fileUploadPromiseCallbacks && window.fileUploadPromiseCallbacks.has(result.uploadId)) {
          const callback = window.fileUploadPromiseCallbacks.get(result.uploadId);
          if (result.success) {
            callback.resolve(result.url);
          } else {
           callback.reject(new Error(result.error));
          }

          // Remove this specific callback
          window.fileUploadPromiseCallbacks.delete(result.uploadId);
        }
      }

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
          onFileUpload
        };

        window.formbricksSurveys.renderSurveyInline(surveyProps);
      }

      const script = document.createElement("script");
      script.src = "${options.apiHost ?? "http://localhost:3000"}/api/packages/surveys";
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
