/** Whether the survey renderer is installed on the page. */
export const isSurveysRendererReady = (): boolean => Boolean(window.formbricksSurveys);

/**
 * Fetches the survey renderer bundle and runs it as an inline script, which installs
 * `window.formbricksSurveys`.
 */
export const loadSurveysScript = async (scriptUrl: string, init: RequestInit = {}): Promise<void> => {
  const response = await fetch(scriptUrl, init);

  if (!response.ok) {
    throw new Error("Failed to load the surveys package");
  }

  const scriptContent = await response.text();
  const scriptElement = document.createElement("script");

  scriptElement.textContent = scriptContent;

  document.head.appendChild(scriptElement);
};
