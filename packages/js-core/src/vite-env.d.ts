/// <reference types="vite/client" />

declare global {
  interface Window {
    /** GTM's data layer. We push via the standard `window.dataLayer = window.dataLayer || []` idiom. */
    dataLayer?: Record<string, unknown>[];
    __formbricksNonce?: string;
    formbricksSurveys?: {
      renderSurvey: (options: unknown) => void;
      setNonce: (nonce: string | undefined) => void;
    };
  }
}

export {};
