import "server-only";
import { Readable } from "node:stream";
import { prisma } from "@formbricks/database";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { buildAnalysisWhere, openAnalysisExport } from "@/lib/analysis-export";
import { rowCells } from "@/lib/analysis-export/analysis-workbook";
import { CSV_BOM, analysisCsvLine } from "@/lib/analysis-export/csv-file";
import { dataHeaderCells, dataParts } from "@/lib/analysis-export/data-files";
import { type TExportPlan, exportFileType } from "@/lib/analysis-export/export-request";
import { XlsxLimitError, buildAnalysisWorkbook, createAnalysisZip } from "@/lib/analysis-export/files";
import type { TAnalysisExport } from "@/lib/analysis-export/types";
import { getResponseDownloadFile } from "@/lib/response/service";
import { getResponsesFileName } from "@/lib/response/utils";
import { buildWhereClause } from "@/lib/response/where-clause";
import { EXCEL_EXPORT_MAX_CELLS } from "./export-limits";

/** Thrown while rows are read once the client has gone: the work stops instead of finishing for nobody. */
export class ExportCancelledError extends Error {
  constructor() {
    super("The export was cancelled because the client disconnected");
    this.name = "ExportCancelledError";
  }
}

/** The same export with a check between batches, so a cancelled request stops reading the database. */
export const stopWhenAborted = (exported: TAnalysisExport, signal: AbortSignal): TAnalysisExport => ({
  ...exported,
  rows: async function* () {
    if (signal.aborted) throw new ExportCancelledError();
    for await (const batch of exported.rows()) {
      if (signal.aborted) throw new ExportCancelledError();
      yield batch;
    }
  },
});

export const buildExportFileName = (surveyName: string, plan: TExportPlan): string =>
  getResponsesFileName(surveyName, exportFileType(plan).extension);

/** The modal's count line: what the export writes, and the Low quality responses it leaves out. */
export const countExportResponses = async ({
  survey,
  plan,
  filter,
}: {
  survey: TSurvey;
  plan: TExportPlan;
  filter?: TResponseFilterCriteria;
}): Promise<{ included: number; lowQualityLeftOut: number }> => {
  if (plan.kind === "standard") {
    // Today's file keeps Low quality responses, so nothing is left out.
    const included = await prisma.response.count({
      where: { surveyId: survey.id, ...buildWhereClause(survey, filter) },
    });
    return { included, lowQualityLeftOut: 0 };
  }
  const where = buildAnalysisWhere(survey, filter);
  const [included, lowQualityLeftOut] = await Promise.all([
    prisma.response.count({ where: where.included }),
    where.lowQualityLeftOut ? prisma.response.count({ where: where.lowQualityLeftOut }) : 0,
  ]);
  return { included, lowQualityLeftOut };
};

const downloadHeaders = (plan: TExportPlan, fileName: string): Record<string, string> => ({
  "Content-Type": exportFileType(plan).mime,
  "Content-Disposition": `attachment; filename="${fileName}"`,
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});

/** `data.csv` of an Analysis export, streamed batch by batch: one batch of rows in memory at a time. */
const streamAnalysisCsv = (
  exported: TAnalysisExport,
  display: "codes" | "text"
): ReadableStream<Uint8Array> => {
  const [part] = dataParts(display);
  const encoder = new TextEncoder();
  const batches = exported.rows();
  let started = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(
            encoder.encode(CSV_BOM + analysisCsvLine(dataHeaderCells(exported.columns, display, part.kind)))
          );
          return;
        }
        const next = await batches.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(
          encoder.encode(next.value.map((row) => analysisCsvLine(rowCells(row, part.kind))).join(""))
        );
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await batches.return();
    },
  });
};

export type TExportResult =
  | { ok: true; response: Response }
  | { ok: false; reason: "excel_too_large"; message: string };

/**
 * The file of an export, as a download. The Standard export goes through the existing path unchanged
 * (`getResponseDownloadFile`, ENG-6779 pins its bytes). An Analysis export streams when it can: the CSV
 * and the zip hold one batch of rows in memory; only Excel is built whole.
 */
export const buildExportResponse = async ({
  survey,
  plan,
  filter,
  isQuotasAllowed,
  timeZone,
  signal,
}: {
  survey: TSurvey;
  plan: TExportPlan;
  filter?: TResponseFilterCriteria;
  isQuotasAllowed: boolean;
  timeZone: string;
  signal: AbortSignal;
}): Promise<TExportResult> => {
  if (plan.kind === "standard") {
    const { fileContents, fileName } = await getResponseDownloadFile(survey.id, plan.format, filter);
    const body = plan.format === "xlsx" ? Buffer.from(fileContents, "base64") : fileContents;
    return { ok: true, response: new Response(body, { headers: downloadHeaders(plan, fileName) }) };
  }

  const exported = stopWhenAborted(
    await openAnalysisExport({
      surveyId: survey.id,
      filter,
      answers: plan.display,
      fields: {
        timestamp: true,
        finished: true,
        tags: true,
        contact: true,
        quotas: true,
        verifiedEmail: true,
        embeddedData: true,
        metadata: true,
      },
      isQuotasAllowed,
      timeZone,
    }),
    signal
  );
  const headers = downloadHeaders(plan, buildExportFileName(survey.name, plan));

  if (plan.output === "xlsx") {
    try {
      const workbook = await buildAnalysisWorkbook(exported, {
        display: plan.display,
        timeZone,
        include: plan.include,
        maxCells: EXCEL_EXPORT_MAX_CELLS,
      });
      return { ok: true, response: new Response(new Uint8Array(workbook), { headers }) };
    } catch (error) {
      if (error instanceof XlsxLimitError) {
        return { ok: false, reason: "excel_too_large", message: error.message };
      }
      throw error;
    }
  }

  if (plan.output === "zip") {
    const archive = createAnalysisZip(exported, { display: plan.display, timeZone, include: plan.include });
    return {
      ok: true,
      response: new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, { headers }),
    };
  }

  // `csv`: one data table, Code only or Text only (Text and code is always a zip).
  return {
    ok: true,
    response: new Response(streamAnalysisCsv(exported, plan.display === "text" ? "text" : "codes"), {
      headers,
    }),
  };
};
