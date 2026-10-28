import type { JsonRecord } from "./types";

/** The slice of the `formbricksSurveys` global (packages/surveys/src/umd.ts) the preview uses. */
interface SurveysGlobal {
  renderSurveyInline: (props: JsonRecord) => void;
}

declare global {
  interface Window {
    formbricksSurveys?: SurveysGlobal;
  }
}

const LOAD_TIMEOUT_MS = 20_000;

let pending: { url: string; promise: Promise<SurveysGlobal> } | null = null;

/**
 * Loads the respondent renderer once per page, from the URL the server named. Resolves with the global the
 * script defines; rejects when the script is blocked (CSP), unreachable or never defines it, which the
 * Try it tab reports while the Review tab carries on.
 */
export const loadRenderer = (url: string): Promise<SurveysGlobal> => {
  if (window.formbricksSurveys) return Promise.resolve(window.formbricksSurveys);
  if (pending?.url === url) return pending.promise;

  const promise = new Promise<SurveysGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(new Error("timed out")), LOAD_TIMEOUT_MS);
    const cleanup = () => window.clearTimeout(timer);
    const fail = (error: Error) => {
      cleanup();
      script.remove();
      pending = null;
      reject(error);
    };
    script.src = url;
    script.async = true;
    script.onload = () => {
      cleanup();
      if (window.formbricksSurveys) resolve(window.formbricksSurveys);
      else fail(new Error("the renderer did not register"));
    };
    script.onerror = () => fail(new Error("the script could not be loaded"));
    document.head.appendChild(script);
  });
  pending = { url, promise };
  return promise;
};
