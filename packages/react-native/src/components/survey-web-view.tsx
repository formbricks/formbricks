 
 
/* eslint-disable no-console -- debugging*/
import React, { type JSX, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { RNConfig } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { ResponseQueue } from "@/lib/common/response-queue";
import { filterSurveys, getLanguageCode, getStyling } from "@/lib/common/utils";
import { SurveyState } from "@/lib/survey/state";
import { SurveyStore } from "@/lib/survey/store";
import { type TEnvironmentStateSurvey, type TUserState, ZJsRNWebViewOnMessageData } from "@/types/config";
import type { SurveyContainerProps } from "@/types/survey";

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
            apiHost: appConfig.get().appUrl,
            environmentId: appConfig.get().environmentId,
            userId: appConfig.get().user.data.userId ?? undefined,
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

            const { onDisplay, onResponse, onClose, onRetry, onFinished } = validatedMessage.data;
            if (onDisplay) {
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
            if (onResponse) {
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
          } catch (error) {
            logger.error(`Error handling WebView message: ${error as string}`);
          }
        }}
      />
    </Modal>
  );
}

const renderHtml = (options: Partial<SurveyContainerProps> & { appUrl?: string }): string => {
  return `
  <!doctype html>
  <html>
    <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
    <head>
      <title>Formbricks WebView Survey</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body style="overflow: hidden; height: 100vh; margin: 0;">
      <div class="survey-container>
        <div id="formbricks-react-native">
          <div></div>
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
        window.ReactNativeWebView.postMessage(JSON.stringify({ onResponse: true }));
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
          onDisplayCreated: onDisplay,
          onResponseCreated: onResponse,
          onRetry,
          onClose,
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
    </script>
  </html>
  `;
};
