import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import type { TImportProgress, TImportReport, TImportReportSource } from "@/modules/survey/import/types";
import type { TSurveyStreamErrorEvent } from "../../lib/stream-events";

/**
 * The import stream's grammar: the generation stream's events plus `progress`, and a `done` that
 * carries the import report. `partial.draft` is a mid-generation snapshot (unvalidated, display only);
 * `blockOffset` counts the blocks earlier chunks already finalized so the dialog appends rather than
 * replaces.
 */
export type TSurveyImportStreamEvent =
  | { type: "start"; requestId: string; source: TImportReportSource }
  | ({ type: "progress" } & TImportProgress)
  | { type: "partial"; seq: number; draft: unknown; blockOffset: number }
  | {
      type: "done";
      /** The create body the import route persists; null when the report carries errors. */
      payload: TV3CreateSurveyBody | null;
      /** The resolved public document (locale-code maps), for the review step. */
      document: Record<string, unknown> | null;
      references: unknown | null;
      validation: { valid: boolean; invalid_params: InvalidParam[] };
      report: TImportReport;
    }
  | TSurveyStreamErrorEvent;
