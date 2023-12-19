import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

// In development mode, use localhost for iOS and 10.0.2.2 for Android (special address to access host machine from Android emulator).
const BASE_URL = __DEV__
  ? Platform.OS === 'ios' ? 'http://localhost:3000' : 'http://10.0.2.2:3000'
  : 'https://formbricks.com';

interface RefObject {
  current: FormBricksEmbedRef | null;
}

interface FormBricksEmbedRef {
  show: (surveyId: string) => void;
}

let refs: RefObject[] = [];

function addNewRef(newRef: FormBricksEmbedRef) {
  refs.push({
    current: newRef
  });
}

function removeOldRef(oldRef: FormBricksEmbedRef | null) {
  refs = refs.filter((r) => r.current !== oldRef);
}

function getRef(): FormBricksEmbedRef | null {
  const reversePriority = [...refs].reverse();
  const activeRef = reversePriority.find((ref) => ref?.current !== null);
  if (!activeRef) {
    return null;
  }
  return activeRef.current;
}

const FormBricksEmbed = React.forwardRef<FormBricksEmbedRef, {}>((_props, ref) => {
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const webViewRef = useRef<WebView | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      show: setSurveyId,
    }),
  );

  useEffect(() => {
    if (surveyId && webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [surveyId]);

  return surveyId ? (
    // @ts-ignore
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
            setSurveyId(null);
          }
        } catch (error) {
        }
      }}
    />
  ) : null;
});

FormBricksEmbed.displayName = 'FormBricksEmbed'

export const FormBricks = (props: {}) => {
  const formBricksRef = useRef<FormBricksEmbedRef | null>(null);

  const setRef = (ref: FormBricksEmbedRef | null) => {
    if (ref) {
      formBricksRef.current = ref;
      addNewRef(ref);
    } else {
      removeOldRef(formBricksRef.current);
    }
  };
  // @ts-ignore
  return <FormBricksEmbed ref={setRef} {...props} />;
};

export const showSurvey = (surveyId: string) => {
  getRef()?.show(surveyId);
};