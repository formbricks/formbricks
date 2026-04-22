/// <reference types="vite/client" />

declare global {
  interface Window {
    formbricksSurveys?: {
      renderSurveyInline: (...args: unknown[]) => unknown;
      renderSurveyModal: (...args: unknown[]) => unknown;
      renderSurvey: (options: unknown) => void;
      onFilePick: (...args: unknown[]) => unknown;
      setNonce: (nonce: string | undefined) => void;
    };
  }
}

export {};
