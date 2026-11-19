/**
 * How often the loader fetches the renderer bundle before giving up. A body cut mid-transfer, or a
 * partially cached copy, fails to parse; the second fetch bypasses the HTTP cache (ENG-3601).
 */
const MAX_LOAD_ATTEMPTS = 2;

/**
 * Whether the survey renderer is installed on the page. Probes for the function the loader needs,
 * not for the global: the UMD wrapper publishes `window.formbricksSurveys = {}` before its factory
 * runs, so a bundle that throws partway leaves a truthy global with no renderer in it.
 */
export const isSurveysRendererReady = (): boolean =>
  typeof window.formbricksSurveys?.renderSurvey === "function";

/**
 * Fetches the survey renderer bundle and runs it as an inline script, which installs
 * `window.formbricksSurveys`. Resolves only once the renderer is installed.
 *
 * A script that fails to parse or throws does not throw out of `appendChild`: the browser reports
 * it on `window` and `appendChild` returns normally. So success is read from the page afterwards,
 * and a failed attempt's script is removed before the next one.
 */
export const loadSurveysScript = async (scriptUrl: string, init: RequestInit = {}): Promise<void> => {
  for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
    const response = await fetch(
      scriptUrl,
      attempt === 1 ? init : { ...init, cache: init.cache ?? "reload" }
    );

    if (!response.ok) {
      throw new Error("Failed to load the surveys package");
    }

    const scriptContent = await response.text();
    const scriptElement = document.createElement("script");

    scriptElement.textContent = scriptContent;

    document.head.appendChild(scriptElement);

    if (isSurveysRendererReady()) {
      return;
    }

    scriptElement.remove();
  }

  throw new Error("The surveys package did not install its renderer");
};
