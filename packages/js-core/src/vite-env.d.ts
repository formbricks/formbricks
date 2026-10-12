/// <reference types="vite/client" />

declare global {
  interface Window {
    /** GTM's data layer. We push via the standard `window.dataLayer = window.dataLayer || []` idiom. */
    dataLayer?: Record<string, unknown>[];
    __formbricksNonce?: string;
    formbricksSurveys?: {
      renderSurvey: (options: unknown) => void;
      // Optional: the surveys bundle is served by the (possibly self-hosted, older)
      // Formbricks instance, so it may predate setNonce.
      setNonce?: (nonce: string | undefined) => void;
      // Optional for the same reason: older renderers have no appearance support.
      setAppearance?: (appearance: "light" | "dark" | "system") => void;
      // Optional for the same reason: renderers older than custom CSS have nothing to remove.
      removeCustomCss?: () => void;
      // The shared survey language resolver. Lives in the surveys bundle so the SDK never ships the
      // canonical language table; optional for the same reason as setNonce. Hand-mirrors the signature
      // of `resolveSurveyLanguage` in @formbricks/i18n-utils (js-core deliberately has no dependency on
      // it) — keep the two identical.
      resolveSurveyLanguage?: (input: {
        languages: readonly {
          default: boolean;
          enabled: boolean;
          language: { code: string; alias?: string | null };
        }[];
        explicitLanguage?: string | null;
        browserLanguages?: readonly string[];
        autoSelectLanguage?: boolean | null;
        unmatchedExplicitLanguage: "fallback" | "skip";
      }) => string | null;
    };
  }
}

export {};
