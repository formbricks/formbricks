/// <reference types="vite/client" />

declare global {
  interface Window {
    __formbricksNonce?: string;
    formbricksSurveys?: {
      renderSurvey: (options: unknown) => void;
      setNonce: (nonce: string | undefined) => void;
    };
  }
}

export {};
