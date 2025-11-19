export const downloadSurveyJson = (surveyName: string, jsonContent: string): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("downloadSurveyJson can only be used in a browser environment");
  }

  const trimmedName = (surveyName ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);
  let normalizedFileName = trimmedName || `survey-${today}`;

  if (!normalizedFileName.toLowerCase().endsWith(".json")) {
    normalizedFileName = `${normalizedFileName}-export-${today}.json`;
  }

  const file = new File([jsonContent], normalizedFileName, {
    type: "application/json;charset=utf-8",
  });

  const link = document.createElement("a");
  let url: string | undefined;

  url = URL.createObjectURL(file);
  link.href = url;
  link.download = normalizedFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
