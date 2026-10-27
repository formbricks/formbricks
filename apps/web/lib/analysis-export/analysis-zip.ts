import { type Archiver, ZipArchive } from "archiver";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { TAnalysisFileOptions } from "./analysis-workbook";
import { rowCells } from "./analysis-workbook";
import { createColumnStats } from "./column-stats";
import { CSV_BOM, analysisCsvLine } from "./csv-file";
import { type TDataPart, dataHeaderCells, dataParts } from "./data-files";
import { DATAMAP_HEADERS, buildDatamap } from "./datamap";
import { buildSpssSyntax } from "./spss-syntax";
import type { TAnalysisExport } from "./types";
import { UNMAPPED_HEADERS, buildUnmappedValuesTable, unmappedColumnNames } from "./unmapped-values";

/** Resolves when archiver has taken the entry; rejects if the archive is closed or fails first. */
const appendEntry = (archive: Archiver, source: Readable | string, name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      if (typeof source !== "string") source.off("error", onFail);
      archive.off("entry", onEntry);
      archive.off("error", onFail);
      archive.off("close", onClose);
    };
    const onEntry = (entry: { name: string }) => {
      if (entry.name !== name) return;
      cleanup();
      resolve();
    };
    const onFail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => onFail(new Error("The export was cancelled before it finished"));
    archive.on("entry", onEntry);
    archive.on("error", onFail);
    archive.on("close", onClose);
    // Archiver does not forward an error of the stream it reads, so listen here.
    if (typeof source !== "string") source.on("error", onFail);
    archive.append(source, { name });
  });

/**
 * The zip of an Analysis export: `data.csv` (or `labels.csv` plus `codes.csv`), `datamap.csv`,
 * `unmapped-values.csv` and `labels.sps`. Streams: rows are pulled as archiver drains the stream, so
 * memory holds one batch of rows. The Datamap, the Unmapped values and the syntax come last, because
 * they need the whole row pass (the unmapped list, the widths of the columns).
 *
 * With Text and code the one row pass feeds two files; `codes.csv` is spooled to a temporary file
 * while `labels.csv` streams out, so memory stays flat there too. The file is removed when the zip is
 * done, fails or is cancelled.
 *
 * Returns the archive, a Readable: pipe it or `Readable.toWeb` it into a Response. A failure while
 * reading rows destroys the stream with that error.
 */
export const createAnalysisZip = (
  exported: TAnalysisExport,
  { display, timeZone }: TAnalysisFileOptions
): Readable => {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const parts = dataParts(display);
  const stats = createColumnStats(exported.columns.length);
  const statsKind: TDataPart["kind"] = display === "text" ? "labels" : "codes";

  const run = async (): Promise<void> => {
    const [primary, spooled] = parts;
    let spoolDir: string | null = null;
    try {
      let spool: ReturnType<typeof createWriteStream> | null = null;
      let spoolPath = "";
      if (spooled) {
        spoolDir = await mkdtemp(join(tmpdir(), "analysis-export-"));
        spoolPath = join(spoolDir, spooled.csvName);
        spool = createWriteStream(spoolPath);
        spool.on("error", () => undefined);
        spool.write(CSV_BOM + analysisCsvLine(dataHeaderCells(exported.columns, display, spooled.kind)));
      }

      async function* primaryCsv(): AsyncGenerator<string> {
        yield CSV_BOM + analysisCsvLine(dataHeaderCells(exported.columns, display, primary.kind));
        for await (const batch of exported.rows()) {
          let text = "";
          let spoolText = "";
          for (const row of batch) {
            text += analysisCsvLine(rowCells(row, primary.kind));
            if (spooled) spoolText += analysisCsvLine(rowCells(row, spooled.kind));
            stats.observe(rowCells(row, statsKind));
          }
          if (spool && spoolText && !spool.write(spoolText)) await once(spool, "drain");
          yield text;
        }
      }

      await appendEntry(archive, Readable.from(primaryCsv(), { objectMode: false }), primary.csvName);

      if (spool && spooled) {
        spool.end();
        await once(spool, "finish");
        await appendEntry(archive, createReadStream(spoolPath), spooled.csvName);
        // Read to the end by now: free the disk before the rest is written.
        await rm(spoolDir!, { recursive: true, force: true });
        spoolDir = null;
      }

      const summary = exported.summary();
      const unmappedColumns = unmappedColumnNames(summary);

      const datamap = [
        analysisCsvLine([...DATAMAP_HEADERS]),
        ...buildDatamap(exported.columns, { unmappedColumns }).map(analysisCsvLine),
      ].join("");
      await appendEntry(archive, CSV_BOM + datamap, "datamap.csv");

      const unmapped = [
        analysisCsvLine([...UNMAPPED_HEADERS]),
        ...buildUnmappedValuesTable(summary).map(analysisCsvLine),
      ].join("");
      await appendEntry(archive, CSV_BOM + unmapped, "unmapped-values.csv");

      const syntax = buildSpssSyntax({
        columns: exported.columns,
        display,
        stats: stats.result(),
        unmappedColumns,
        timeZone,
      });
      await appendEntry(archive, CSV_BOM + syntax, "labels.sps");

      await archive.finalize();
    } finally {
      if (spoolDir) await rm(spoolDir, { recursive: true, force: true });
    }
  };

  run().catch((error: unknown) => {
    archive.destroy(error instanceof Error ? error : new Error(String(error)));
  });
  return archive;
};
