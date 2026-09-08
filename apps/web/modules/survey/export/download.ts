import type { TSurveyExportEnvelopeFile } from "@/modules/survey/export/build-export-envelope";
import { getSurveyExportFileName } from "@/modules/survey/export/file-name";
import { exportSurvey } from "@/modules/survey/list/lib/v3-surveys-client";

/**
 * Fetch the export envelope for a survey and hand it to the browser as a `.formbricks.json` download.
 * Throws the `V3ApiError` the client raises so the caller can show the API's message.
 */
export async function downloadSurveyExport(survey: { id: string; name: string }): Promise<void> {
  const envelope = await exportSurvey(survey.id);
  saveSurveyExportFile(envelope, getSurveyExportFileName(survey));
}

export function saveSurveyExportFile(envelope: TSurveyExportEnvelopeFile, fileName: string): void {
  const blob = new Blob([`${JSON.stringify(envelope, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
