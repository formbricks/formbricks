export const downloadSurveyJson = (surveyName: string, jsonContent: string) => {
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `${surveyName}-export-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
