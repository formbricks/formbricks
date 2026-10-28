import type { RenderSurveyLanguage, SurveyLanguage } from "./types";

/**
 * The renderer takes `default` for the survey's default language and the language's own code for the
 * others, where the review tab and the v3 resource name every language by code. This maps the code the
 * person picked to the one the renderer expects; a code the renderer does not know falls back to the
 * default language rather than rendering nothing.
 */
export const toRendererLanguage = (
  code: string,
  surveyLanguages: SurveyLanguage[],
  renderLanguages: RenderSurveyLanguage[]
): string => {
  const picked = surveyLanguages.find((language) => language.code.toLowerCase() === code.toLowerCase());
  if (!picked || picked.default) return "default";
  const match = renderLanguages.find(
    (language) => language.language.code.toLowerCase() === picked.code.toLowerCase()
  );
  return match ? (match.default ? "default" : match.language.code) : "default";
};

/** The language to open on: the one the tool was asked for when the survey has it, else the default. */
export const pickInitialLanguage = (
  requested: unknown,
  languages: SurveyLanguage[],
  defaultLanguage: string
): string => {
  const requestedList: unknown[] = Array.isArray(requested) ? requested : [];
  const wanted = requestedList[0];
  if (typeof wanted === "string") {
    const match = languages.find(
      (language) =>
        language.enabled &&
        (language.code.toLowerCase() === wanted.toLowerCase() ||
          language.alias?.toLowerCase() === wanted.toLowerCase())
    );
    if (match) return match.code;
  }
  return defaultLanguage;
};

/**
 * The renderer script is loaded from the deployment the tool result names, as a plain `<script src>`. The
 * host's CSP is the real gate (it only allows the origins the resource declared); this refuses anything
 * that is not http(s) before the browser is asked, so a malformed result reads as "unavailable" instead
 * of injecting a `javascript:` or `data:` source.
 */
export const toScriptUrl = (rendererUrl: string, base: string): string | null => {
  try {
    const url = new URL(rendererUrl, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Links go to the host's `ui/open-link`, and only http(s) ones: a survey author controls the URL. */
export const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};
