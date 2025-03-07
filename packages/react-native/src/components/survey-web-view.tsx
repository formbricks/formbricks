/* eslint-disable no-console -- debugging*/
import React, { type JSX, useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { RNConfig } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys, getLanguageCode, getStyling } from "@/lib/common/utils";
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
            contactId: appConfig.get().user.data.contactId ?? undefined,
            survey,
            isBrandingEnabled,
            styling,
            languageCode,
            placement: surveyPlacement,
            appUrl: appConfig.get().appUrl,
            clickOutside: surveyPlacement === "center" ? clickOutside : true,
            darkOverlay,
            getSetIsResponseSendingFinished: (_f: (value: boolean) => void) => undefined,
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
        onMessage={(event: WebViewMessageEvent) => {
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

            const { onDisplayCreated, onResponseCreated, onClose, onFinished } = validatedMessage.data;
            if (onDisplayCreated) {
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
            if (onResponseCreated) {
              const responses = appConfig.get().user.data.responses;
              const newPersonState: TUserState = {
                ...appConfig.get().user,
                data: {
                  ...appConfig.get().user.data,
                  responses: [...responses, survey.id],
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

      function onDisplayCreated() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onDisplayCreated: true }));
      };

      function onResponseCreated() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onResponseCreated: true }));
      };

      function loadSurvey() {
        const options = ${JSON.stringify(options)};
        const surveyProps = {
          ...options,
          onFinished,
          onDisplayCreated,
          onResponseCreated,
          onClose,
        };
        
        window.formbricksSurveys.renderSurvey(surveyProps);
      }

      const script = document.createElement("script");
      script.src = "https://question-date-test.s3.ap-south-1.amazonaws.com/surveys.umd.cjs?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEPj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCmFwLXNvdXRoLTEiSDBGAiEA3DtIqvKG1Ky0%2Bg8rBTdjEyg7Dz5HhJrq7UB0aB6GUAsCIQCv3wW8E%2B4np4RNWUBXUMHlQKhRbFxKlRinlU9rrba6xyrLAwhBEAEaDDU3Njc3NTQzODYyNSIMXiT0WN3zvIcmNgowKqgDFZbUeA%2BQS1K4oR%2FjD7ViwKHr0AiEQKhhflMowVvJBP0pACCDygJj79HAfPie25kEBSGoo9Tm5VIravfgO%2BYSZ%2FN9enL5BKDcVzEYahDU08qe72EcDLGwFaTssX6vawpJlKvnJx0YlhSI%2Bk8brkZqqH7jPC8b5PbAoUJdieUKt2BIBSzRm%2B2hs%2FYQ21J%2FsvWDu1AdFjbFU3o0pPlhqoVZVSZf9SeQk9kHXrbBIXy4273zXDpwQE7bZ3JTotFWDBcYu%2BEU7jVt0shxzYVH1oezzVrSMRCNFtAej4UI%2Fg9bPWUG%2BHI8QASY2I1gm1mWez5bH5VVL6VBEcsIMnslBuw1UTruv878VSViGpijBNcBYE9Nf3MTeJoUXm8JGmUFX3nyRw9mrRxEcTv%2BfkWsEYGb3ZrXt5Soz%2BGP6cqoa8YyTwfi%2FnoJbwd4KjClzwTTHyea%2FPC2THQ09TBAR%2FpD0vExlG4Vqyg6vrvme%2FYfXKWsxGapXGPBDBhu%2Fd8rWZJ8DbGwfRfL4VppoPtSIjcFicxX%2F2CjMuNPDtNmSnv%2FAHvUqZxx%2BExNZ4l0KzC%2B1Kq%2BBjrjAtjVzvaUayHuck1mh7SzsvoX7APzaIbUWmFe4hAo6Pe2Z%2Bv9MfY3ruAdhacCQg%2FZWZ41bwsYVxZHhvsFcr7zBfdCkEgTPibTTZAl4MtbelFUHm7rB8hojgcX35NJBWK0yfF7%2Feh4G8Y2Qt9VTdpmDcAWCIWUrsG6WELo77RlEhwf2nMjv5Q8Hx%2FDaPx1gdiGGRlxsb5Uo91azuktA8WxekvdcapJATPAZe2kif%2BYQ3iaCEl9033%2ByMlS4HQYo%2BiXaOU6Vt6%2FT7DhAQy9KPowck46kUKqjUZ1j4oW8ojGIcXPkRcXWOKQ8Lb4QVvJY2W4hAtmceLdbtFk3A7%2FX9XdgGeAFGq%2FvGotI4IUVEusExOcoL%2F%2Bp6FchyABPUcT%2FwjQrRiVMFVnQpjjm84dHt82bevvFWbBaWWyTGiJXYyiY6o9lybwesRTLbWTW8bKlB%2Fhc4j9p4EVIVuBrPmC9CzWHEvokb0%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIAYMST6YEQ7WAUUEIN%2F20250307%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20250307T081222Z&X-Amz-Expires=43200&X-Amz-SignedHeaders=host&X-Amz-Signature=c2687032fdffe3c9c52e2767af26779110159fe9dda65879bb350858d466bd82";
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
