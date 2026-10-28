/**
 * The most cells an Excel export may hold, over its data sheets (every position, header and blanks
 * included). Excel is built whole in memory inside the web process; CSV and the zip stream and have no
 * cap. Above it the route answers 422 and the Export modal switches Excel off and offers CSV.
 *
 * MEASURED (ENG-6793, `apps/web/scripts/excel-export-memory-spike.ts`; Node 22.22, 4 vCPU, the real
 * `buildAnalysisWorkbook`, two data sheets Labels + Codes, 300 columns, ~15% blank cells, Arabic open
 * text; one process per run, default 2 GB V8 heap; peak RSS includes ~130 MB of the script's own baseline):
 *
 *   rows     cells        time    peak RSS   peak heap  file
 *   1,666    1.0 M        4.5 s     617 MB     322 MB    7.9 MB   (10,000 rows x 50 columns: 574 MB)
 *   2,500    1.5 M        6.1 s     729 MB     253 MB   11.9 MB
 *   5,000    3.0 M       12.4 s   1,314 MB     522 MB   23.8 MB
 *   7,500    4.5 M       19.4 s   2,252 MB     791 MB   35.7 MB
 *   10,000   6.0 M       23.8 s   2,280 MB   1,297 MB   47.6 MB
 *   25,000   15.0 M      -        out of memory at the 2 GB default heap; with a 10 GB heap it still fails
 *                                 with `RangeError: Invalid string length` (one sheet's XML passes V8's
 *                                 ~512 MB string limit), so the 25,000 x 300 workbook cannot be built at all
 *   50,000   30.0 M      -        out of memory
 *
 * That is roughly 400 bytes of RSS per cell, about 0.5 GB per million cells, and a few seconds per
 * million. The route copies the Buffer once more (`new Uint8Array`) while it responds.
 *
 * The cap is 1,000,000 cells, about 0.5 GB at the peak. ASSUMPTION: a 1-2 GB web container whose Next.js
 * process already uses ~0.5 GB; one export at the cap fits with room to spare, and a smaller workbook costs
 * proportionally less. In rows: 25,000 responses of up to 20 columns Code only, 12,500 of 20 Text and
 * code, 1,600 of 300 Text and code. Raise it only after re-running the spike on the target container.
 */
export const EXCEL_EXPORT_MAX_CELLS: number | undefined = 1_000_000;
