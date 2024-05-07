export const loadSurveyScript: () => Promise<void> = async () => {
  try {
    const response = await fetch("/api/packages/surveys");

    if (!response.ok) {
      throw new Error("Failed to load the surveys package");
    }

    const scriptContent = await response.text();
    const scriptElement = document.createElement("script");

    // append the script content to the script element
    scriptElement.textContent = scriptContent;

    // append the script element to the head of the document
    document.head.appendChild(scriptElement);
  } catch (error) {
    // handle when loading the script
    throw error;
  }
};
