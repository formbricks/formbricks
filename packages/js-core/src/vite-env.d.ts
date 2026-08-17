/// <reference types="vite/client" />

declare global {
  interface Window {
    __formbricksNonce?: string;
    formbricksSurveys?: {
      renderSurvey: (options: unknown) => void;
      // Optional: the surveys bundle is served by the (possibly self-hosted, older)
      // Formbricks instance, so it may predate setNonce.
      setNonce?: (nonce: string | undefined) => void;
    };
  }
}

export {};
