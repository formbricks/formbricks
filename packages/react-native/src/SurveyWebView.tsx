import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  PanResponderInstance,
  View,
} from "react-native";
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

// Animation Constants
const screenHeight = Dimensions.get("window").height;
const modalMaxHeight = (screenHeight * 3) / 4;
const defaultModalHeight = screenHeight / 2;
const modalMinHeight = (screenHeight * 1) / 4;
const maxY = modalMaxHeight + 150;
const minY = 0;
const swipeThreshold = 60;
const minSwipeThreshold = 10;

export const SurveyWebView = ({ survey }: SurveyWebViewProps) => {
  const [showSurvey, setShowSurvey] = useState(false);
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

  useEffect(() => {
    // if (survey.delay) {
    //   setTimeout(() => {
    //     setShowSurvey(true);
    //   }, survey.delay * 1000);
    //   return;
    // }
    setShowSurvey(true);
  }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardWillShow", (event) => {
      if (previousHeightRef.current !== defaultModalHeight) {
        return;
      }
      Animated.timing(modalHeightRef, {
        toValue: screenHeight / 2 + event.endCoordinates.height / 2,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    const keyboardDidHideListener = Keyboard.addListener("keyboardWillHide", () => {
      if (previousHeightRef.current !== defaultModalHeight) {
        return;
      }
      Animated.timing(modalHeightRef, {
        toValue: screenHeight / 2,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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
    surveyStore.resetSurvey();
    setShowSurvey(false);
  };

  const modalHeightRef = useRef<Animated.Value>(new Animated.Value(defaultModalHeight)).current;
  const previousHeightRef = useRef<number>(defaultModalHeight);
  const gestureDirection = useRef<"up" | "down" | null>(null);

  const panResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => false,
      onStartShouldSetPanResponder: () => {
        gestureDirection.current = null;
        return true;
      },
      onPanResponderGrant: () => {
        modalHeightRef.extractOffset();
        modalHeightRef.setValue(0);
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx === 0 && gesture.dy === 0) {
          return;
        }
        modalHeightRef.setValue(-gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        modalHeightRef.flattenOffset();
        const dy = -gesture.dy;

        if (dy > minSwipeThreshold && dy > swipeThreshold) {
          // pan up
          if (previousHeightRef.current === maxY) {
            animateSprintTo(maxY);
            return;
          } else if (previousHeightRef.current === defaultModalHeight) {
            animateSprintTo(maxY);
            return;
          } else if (previousHeightRef.current === minY) {
            animateSprintTo(defaultModalHeight);
            return;
          }
        }
        // pan down
        if (dy < -minSwipeThreshold && dy < -swipeThreshold) {
          if (previousHeightRef.current === minY) {
            animateSprintTo(minY);
            return;
          } else if (previousHeightRef.current === defaultModalHeight) {
            animateSprintTo(minY);
            return;
          } else if (previousHeightRef.current === maxY) {
            animateSprintTo(defaultModalHeight);
            return;
          }
        }
        // defaults back to
        animateSprintTo(previousHeightRef.current);
        return;
      },
    })
  ).current;

  const animateSprintTo = (value: number) => {
    previousHeightRef.current = value;
    Animated.spring(modalHeightRef, {
      toValue: previousHeightRef.current,
      useNativeDriver: false,
    }).start();
  };

  const animatedStyles = {
    height: modalHeightRef.interpolate({
      inputRange: [minY, maxY],
      outputRange: [modalMinHeight, modalMaxHeight],
      extrapolate: "clamp",
    }),
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showSurvey}
      onRequestClose={() => {
        setShowSurvey(false);
      }}>
      <Animated.View
        style={{
          backgroundColor: "white",
          marginTop: "auto",
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
          ...animatedStyles,
        }}>
        <View
          style={{
            position: "relative",
            top: 0,
            width: "100%",
            height: 20,
            justifyContent: "center",
            alignItems: "center",
          }}
          {...panResponder.panHandlers}>
          <View
            style={{ width: 80, height: 6, bottom: 4, backgroundColor: "black", borderStartEndRadius: 2 }}
          />
        </View>
        <WebView
          originWhitelist={["*"]}
          source={{ html: renderHtml(survey, isBrandingEnabled, brandColor) }}
          style={{ flex: 1 }}
          contentMode="mobile"
          onShouldStartLoadWithRequest={(event) => {
            if (event.url.startsWith("https://formbricks")) {
              return false;
            } else {
              return true;
            }
          }}
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
                const { id } = await createDisplay(survey);
                surveyState.updateDisplayId(id);
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

            // retry
            try {
              const { onRetry } = parsedData;
              if (onRetry) {
                responseQueue.processQueue();
              }
            } catch (error) {
              // handle error
            }

            // finished
            try {
              const { onFinished } = parsedData;
              if (onFinished) {
                setTimeout(async () => {
                  await sync(
                    {
                      apiHost: config.get().apiHost,
                      environmentId: config.get().environmentId,
                      userId: config.get().userId,
                    },
                    true
                  );
                  onCloseSurvey();
                }, 2500);
              }
            } catch (error) {
              // handle error
            }
          }}
        />
      </Animated.View>
    </Modal>
  );
};

// todo: update ip to use from env.
const renderHtml = (survey: TSurvey, isBrandingEnabled: boolean, brandColor: string) => {
  return `
  <!doctype html>
  <html>
    <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
    <head>
      <title>Formbricks WebView Survey</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body scroll="no" style="overflow: hidden;">
      <div style="height: 100%; width: 100%; padding: 0% 10%;">
        <div style="margin-top: 5vh;" id="formbricks-react-native" />
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
        window.ReactNativeWebView.postMessage(JSON.stringify({ responseUpdate }));
      };

      function onRetry(responseUpdate) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ onRetry: true }));
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
          onRetry,
          onClose,
        };
        window.formbricksSurveys.renderSurveyInline(surveyProps);
      }

      const script = document.createElement("script");
      script.src = "http://192.168.4.39:3003/index.umd.js";
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
