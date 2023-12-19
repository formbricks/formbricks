import React, { useState, useRef, useCallback, useImperativeHandle } from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const BASE_URL = __DEV__
  ? Platform.OS === 'ios' ? 'http://localhost:3000' : 'http://10.0.2.2:3000'
  : 'https://formbricks.com';

interface FormBricksEmbedRef {
  show: (surveyId: string) => Promise<void>;
}

const formBricksRef = React.createRef<FormBricksEmbedRef>();

const FormBricksEmbed = () => {
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const webViewRef = useRef<WebView | null>(null);

  const hide = useCallback(async () => {
    setSurveyId(null);
  }, []);

  useImperativeHandle(formBricksRef, () => ({
    show: async (newSurveyId: string) => {
      setSurveyId(newSurveyId);
    },
  }));

  return surveyId ? (
    <WebView
      ref={webViewRef}
      source={{ uri: `${BASE_URL}/s/${surveyId}?mobileapp=true` }}
      containerStyle={{
        height: "100%",
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999
      }}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data) as {
            closeModal: boolean
          }

          if (data.closeModal) {
            hide();
          }
        } catch (error) {
        }
      }}
    />
  ) : null;
};

export const FormBricks = FormBricksEmbed;

export const showSurvey = (surveyId: string) => {
  formBricksRef.current?.show(surveyId);
};