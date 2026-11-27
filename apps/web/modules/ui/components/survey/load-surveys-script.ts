import { getClientCspNonce } from "@/lib/csp/client-nonce";

/**
 * How often the loader fetches the renderer bundle before giving up. A body cut mid-transfer, or a
 * partially cached copy, fails to parse; the second fetch bypasses the HTTP cache (ENG-3601).
 */
const MAX_LOAD_ATTEMPTS = 2;

/** The bundle downloaded but never installed `renderSurvey`, on every attempt. */
export class SurveysRendererNotInstalledError extends Error {
  constructor() {
    super("The surveys package did not install its renderer");
    this.name = "SurveysRendererNotInstalledError";
  }
}

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
    // The page's CSP runs an inline script only with its nonce ('strict-dynamic' trusts only scripts
    // loaded by URL).
    const nonce = getClientCspNonce();
    if (nonce) scriptElement.nonce = nonce;

    scriptElement.textContent = scriptContent;

    document.head.appendChild(scriptElement);

    if (isSurveysRendererReady()) {
      // The renderer's own <style> elements need the nonce too.
      window.formbricksSurveys.setNonce(nonce);
      return;
    }

    scriptElement.remove();
  }

  throw new SurveysRendererNotInstalledError();
};
