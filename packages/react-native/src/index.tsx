import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { WebView } from 'react-native-webview';

const BASE_URL = __DEV__ ? 'http://192.168.1.169:3000' : 'https://formbricks.com';

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

// eslint-disable-next-line react/display-name
const FormBricksEmbed = forwardRef<FormBricksEmbedRef, {}>((_props, ref) => {
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

  return <FormBricksEmbed ref={setRef} {...props} />;
};

export const showSurvey = (surveyId: string) => {
  getRef()?.show(surveyId);
};