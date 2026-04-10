import { type ExportableSurvey } from "./types";
import { generateSurveyHtml } from "./generate-html";

export async function generateSurveyPdf(data: ExportableSurvey): Promise<void> {
  const html = generateSurveyHtml(data);

  // Open in a new window and trigger the print dialog (Save as PDF)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");

  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 300);
    };
  }

  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
