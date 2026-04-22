/// <reference types="vite/client" />

declare global {
  interface Window {
    formbricksSurveys?: {
      renderSurveyInline: (...args: never[]) => unknown;
      renderSurveyModal: (...args: never[]) => unknown;
      renderSurvey: (...args: never[]) => unknown;
      onFilePick: (...args: never[]) => unknown;
      setNonce: (nonce: string | undefined) => void;
    };
  }
}

export {};
