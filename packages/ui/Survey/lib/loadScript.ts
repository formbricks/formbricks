export const loadSurveyScript: () => Promise<void> = async () => {
  try {
    const scriptContent = await (await fetch("/api/packages/surveys")).text();
    document.head.appendChild(
      Object.assign(document.createElement("script"), { textContent: scriptContent })
    );
  } catch (error) {
    console.error("Failed to load the surveys package:", error);
  }
};
