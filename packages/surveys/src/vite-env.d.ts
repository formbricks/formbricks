/// <reference types="vite/client" />
import type { resolveSurveyLanguage } from "@formbricks/i18n-utils/survey-language-match";

declare global {
  interface Window {
    formbricksSurveys?: {
      renderSurveyInline: (...args: unknown[]) => unknown;
      renderSurveyModal: (...args: unknown[]) => unknown;
      renderSurvey: (options: unknown) => void;
      onFilePick: (...args: unknown[]) => unknown;
      setNonce: (nonce: string | undefined) => void;
      // Derived from the implementation, so it cannot drift; js-core mirrors it in its own vite-env.d.ts.
      resolveSurveyLanguage: typeof resolveSurveyLanguage;
    };
  }
}

export {};
