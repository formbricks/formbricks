/* eslint-disable @typescript-eslint/restrict-template-expressions -- required for template literals */
/* eslint-disable @typescript-eslint/no-unsafe-call -- required */
/* eslint-disable no-console -- debugging*/
import { RNConfig } from "@/lib/common/config";
import { StorageAPI } from "@/lib/common/file-upload";
import { Logger } from "@/lib/common/logger";
import { ResponseQueue } from "@/lib/common/response-queue";
import { filterSurveys, getDefaultLanguageCode, getLanguageCode, getStyling } from "@/lib/common/utils";
import { SurveyState } from "@/lib/survey/state";
import { SurveyStore } from "@/lib/survey/store";
import { type TEnvironmentStateSurvey, type TUserState, ZJsRNWebViewOnMessageData } from "@/types/config";
import type { TResponseUpdate } from "@/types/response";
import type { TFileUploadParams, TUploadFileConfig } from "@/types/storage";
import type { SurveyInlineProps } from "@/types/survey";
import React, { type JSX, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { FormbricksAPI } from "@formbricks/api";

const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();
logger.configure({ logLevel: "debug" });

const surveyStore = SurveyStore.getInstance();

interface SurveyWebViewProps {
  survey: TEnvironmentStateSurvey;
}

export function SurveyWebView({ survey }: SurveyWebViewProps): JSX.Element | undefined {
  const webViewRef = useRef(null);
  const [isSurveyRunning, setIsSurveyRunning] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);

  const project = appConfig.get().environment.data.project;
  const language = appConfig.get().user.data.language;

  const styling = getStyling(project, survey);
  const isBrandingEnabled = project.inAppSurveyBranding;
  const isMultiLanguageSurvey = survey.languages.length > 1;
  const [languageCode, setLanguageCode] = useState("default");

  const [surveyState, setSurveyState] = useState(
    new SurveyState(survey.id, null, null, appConfig.get().user.data.userId)
  );

  const responseQueue = useMemo(
    () =>
      new ResponseQueue(
        {
          appUrl: appConfig.get().appUrl,
          environmentId: appConfig.get().environmentId,
          retryAttempts: 2,
          setSurveyState,
        },
        surveyState
      ),
    [surveyState]
  );

  useEffect(() => {
    if (isMultiLanguageSurvey) {
      const displayLanguage = getLanguageCode(survey, language);
      if (!displayLanguage) {
        logger.debug(`Survey "${survey.name}" is not available in specified language.`);
        setIsSurveyRunning(false);
        setShowSurvey(false);
        surveyStore.resetSurvey();
        return;
      }
      setLanguageCode(displayLanguage);
      setIsSurveyRunning(true);
    } else {
      setIsSurveyRunning(true);
    }
  }, [isMultiLanguageSurvey, language, survey]);

  useEffect(() => {
    if (!isSurveyRunning) {
      setShowSurvey(false);
      return;
    }

    if (survey.delay) {
      logger.debug(`Delaying survey "${survey.name}" by ${String(survey.delay)} seconds`);
      const timerId = setTimeout(() => {
        setShowSurvey(true);
      }, survey.delay * 1000);

      return () => {
        clearTimeout(timerId);
      };
    }

    setShowSurvey(true);
  }, [survey.delay, isSurveyRunning, survey.name]);

  const addResponseToQueue = (responseUpdate: TResponseUpdate): void => {
    const { userId } = appConfig.get().user.data;
    if (userId) surveyState.updateUserId(userId);

    responseQueue.updateSurveyState(surveyState);
    responseQueue.add({
      data: responseUpdate.data,
      ttc: responseUpdate.ttc,
      finished: responseUpdate.finished,
      language:
        responseUpdate.language === "default" ? getDefaultLanguageCode(survey) : responseUpdate.language,
      displayId: surveyState.displayId,
    });
  };

  const onCloseSurvey = (): void => {
    const { environment: environmentState, user: personState } = appConfig.get();
    const filteredSurveys = filterSurveys(environmentState, personState);

    appConfig.update({
      ...appConfig.get(),
      environment: environmentState,
      user: personState,
      filteredSurveys,
    });

    surveyStore.resetSurvey();
    setShowSurvey(false);
  };

  const createDisplay = async (surveyId: string): Promise<{ id: string }> => {
    const { userId } = appConfig.get().user.data;

    const api = new FormbricksAPI({
      apiHost: appConfig.get().appUrl,
      environmentId: appConfig.get().environmentId,
    });

    const res = await api.client.display.create({
      surveyId,
      ...(userId && { userId }),
    });

    if (!res.ok) {
      throw new Error("Could not create display");
    }

    return res.data;
  };

  const uploadFile = async (file: TFileUploadParams["file"], params?: TUploadFileConfig): Promise<string> => {
    const storage = new StorageAPI(appConfig.get().appUrl, appConfig.get().environmentId);
    return await storage.uploadFile(file, params);
  };

  const surveyPlacement = survey.projectOverwrites?.placement ?? project.placement;
  const clickOutside = survey.projectOverwrites?.clickOutsideClose ?? project.clickOutsideClose;
  const darkOverlay = survey.projectOverwrites?.darkOverlay ?? project.darkOverlay;

  return (
    <Modal
      animationType="slide"
      visible={showSurvey}
      transparent
      onRequestClose={() => {
        setShowSurvey(false);
        setIsSurveyRunning(false);
      }}>
      {/* @ts-expect-error -- WebView type incompatibility with React.Component */}
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{
          html: renderHtml({
            survey,
            isBrandingEnabled,
            styling,
            languageCode,
            placement: surveyPlacement,
            appUrl: appConfig.get().appUrl,
            clickOutside: surveyPlacement === "center" ? clickOutside : true,
            darkOverlay,
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

              const existingDisplays = appConfig.get().user.data.displays;
              const newDisplay = { surveyId: survey.id, createdAt: new Date() };

              const displays = [...existingDisplays, newDisplay];
              const previousConfig = appConfig.get();

              const updatedPersonState = {
                ...previousConfig.user,
                data: {
                  ...previousConfig.user.data,
                  displays,
                  lastDisplayAt: new Date(),
                },
              };

              const filteredSurveys = filterSurveys(previousConfig.environment, updatedPersonState);

              appConfig.update({
                ...previousConfig,
                environment: previousConfig.environment,
                user: updatedPersonState,
                filteredSurveys,
              });
            }
            if (onResponse && responseUpdate) {
              addResponseToQueue(responseUpdate);

              const isNewResponse = surveyState.responseId === null;

              if (isNewResponse) {
                const responses = appConfig.get().user.data.responses;
                const newPersonState: TUserState = {
                  ...appConfig.get().user,
                  data: {
                    ...appConfig.get().user.data,
                    responses: [...responses, surveyState.surveyId],
                  },
                };

                const filteredSurveys = filterSurveys(appConfig.get().environment, newPersonState);

                appConfig.update({
                  ...appConfig.get(),
                  environment: appConfig.get().environment,
                  user: newPersonState,
                  filteredSurveys,
                });
              }
            }
            if (onClose) {
              onCloseSurvey();
            }

            if (onRetry) {
              await responseQueue.processQueue();
            }

            if (onFinished) {
              setTimeout(() => {
                onCloseSurvey();
              }, 2500);
            }
            if (onFileUpload && fileUploadParams) {
              const fileType = fileUploadParams.file.type;
              const fileName = fileUploadParams.file.name;
              const fileDataUri = fileUploadParams.file.base64;

              if (fileDataUri) {
                const file: TFileUploadParams["file"] = {
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

const renderHtml = (options: Partial<SurveyInlineProps> & { appUrl?: string }): string => {
  const isCenter = options.placement === "center";

  // @ts-expect-error -- TODO: fix this
  const _getBackgroundColor = (): "rgba(51, 65, 85, 0.8)" | "rgba(255, 255, 255, 0.9)" | "transparent" => {
    if (isCenter) {
      if (options.darkOverlay) {
        return "rgba(51, 65, 85, 0.8)";
      }

      return "rgba(255, 255, 255, 0.9)";
    }

    return "transparent";
  };

  return `
  <!doctype html>
  <html>
    <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
    <head>
      <title>Formbricks WebView Survey</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body style="overflow: hidden; height: 100vh; margin: 0;">
      <div class="survey-container" id="survey-wrapper">
        <div id="formbricks-react-native">
        </div>
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
        
        window.formbricksSurveys.renderSurvey(surveyProps);
      }

      const script = document.createElement("script");
      script.src = "${options.appUrl ?? "http://localhost:3000"}/js/surveys.umd.cjs";
      script.async = true;
      script.onload = () => loadSurvey();
      script.onerror = (error) => {
        console.error("Failed to load Formbricks Surveys library:", error);
      };

      document.head.appendChild(script);

      // Add click handler to close survey when clicking outside
      document.addEventListener('click', function(event) {
        if(!${options.clickOutside}) return;
        const surveyContainer = document.getElementById('formbricks-react-native');
        if (surveyContainer && !surveyContainer.contains(event.target)) {
          onClose();
        }
      });
    </script>
  </html>
  `;
};
