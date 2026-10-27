import { parse } from "csv-parse/sync";
import { readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { describe, expect, test } from "vitest";
import { readZip } from "./__fixtures__/read-zip";
import { LONG_ARABIC_TEXT, buildSampleExport } from "./__fixtures__/sample-export";
import { createAnalysisZip } from "./analysis-zip";
import { DATAMAP_HEADERS } from "./datamap";
import type { TAnalysisExport } from "./types";
import { UNMAPPED_HEADERS } from "./unmapped-values";

const collect = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

const zipOf = async (
  display: "codes" | "text" | "both",
  exported: TAnalysisExport = buildSampleExport(display)
) => readZip(await collect(createAnalysisZip(exported, { display })));

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const csvOf = (data: Buffer): string[][] => {
  expect(data.subarray(0, 3)).toEqual(BOM);
  return parse(data.subarray(3).toString("utf8"), { relax_column_count: false }) as string[][];
};

describe("createAnalysisZip", () => {
  test("Code or Text: data.csv, datamap.csv, unmapped-values.csv, labels.sps in that order", async () => {
    expect((await zipOf("codes")).map((entry) => entry.name)).toEqual([
      "data.csv",
      "datamap.csv",
      "unmapped-values.csv",
      "labels.sps",
    ]);
    expect((await zipOf("text")).map((entry) => entry.name)[0]).toBe("data.csv");
  });

  test("Text and code: labels.csv plus codes.csv instead of data.csv", async () => {
    expect((await zipOf("both")).map((entry) => entry.name)).toEqual([
      "labels.csv",
      "codes.csv",
      "datamap.csv",
      "unmapped-values.csv",
      "labels.sps",
    ]);
  });

  test("every CSV and the syntax file start with a UTF-8 byte order mark", async () => {
    for (const entry of await zipOf("both")) {
      expect(entry.data.subarray(0, 3), entry.name).toEqual(BOM);
    }
  });

  test("data.csv reads back to the rows: header, codes as text, UNMAPPED cells, Arabic, quotes", async () => {
    const entries = await zipOf("codes");
    const rows = csvOf(entries[0].data);
    expect(rows).toHaveLength(4);
    expect(rows[0].slice(0, 6)).toEqual([
      "response_id",
      "language",
      "outcome",
      "timestamp",
      "finished",
      "colour",
    ]);
    expect(rows[1].slice(0, 2)).toEqual(["resp_1", "en"]);
    expect(rows[1][9]).toBe("01");
    expect(rows[2][9]).toBe("UNMAPPED:Somewhere else");
    // The line break inside the answer is a space, quotes and the comma survive.
    expect(rows[1][11]).toBe('He said "hello" second line, with a comma');
    expect(rows[2][11]).toBe(LONG_ARABIC_TEXT);
    expect(rows[3][11]).toBe("'=SUM(A1:A9)");
    expect(rows[2][14]).toBe("2");
  });

  test("codes are written quoted, so the file says text; counts are bare numbers", async () => {
    const text = (await zipOf("codes"))[0].data.subarray(3).toString("utf8");
    const resp1 = text.split("\r\n")[1];
    expect(resp1).toContain(',"01",9,');
  });

  test("Text and code: labels.csv has `column; Question text` headers and answer text, codes.csv the codes", async () => {
    const entries = await zipOf("both");
    const labels = csvOf(entries[0].data);
    const codes = csvOf(entries[1].data);
    expect(labels[0][5]).toBe("colour; Which colour do you prefer?");
    expect(labels[1][5]).toBe("Red");
    expect(codes[0][5]).toBe("colour");
    expect(codes[1][5]).toBe("1");
    expect(labels).toHaveLength(codes.length);
  });

  test("datamap.csv and unmapped-values.csv carry the fixed English headers", async () => {
    const entries = await zipOf("codes");
    const datamap = csvOf(entries[1].data);
    expect(datamap[0]).toEqual([...DATAMAP_HEADERS]);
    expect(datamap.some((row) => row[0] === "region" && row[6].includes("UNMAPPED:"))).toBe(true);
    const unmapped = csvOf(entries[2].data);
    expect(unmapped[0]).toEqual([...UNMAPPED_HEADERS]);
    expect(unmapped.slice(1).map((row) => row[2])).toEqual(["Somewhere else", "Western Provnce"]);
  });

  test("labels.sps is the golden syntax behind a byte order mark", async () => {
    const entries = await zipOf("codes");
    const sps = entries.find((entry) => entry.name === "labels.sps")!.data;
    expect(sps.subarray(0, 3)).toEqual(BOM);
    expect(sps.subarray(3).toString("utf8")).toBe(
      readFileSync(join(__dirname, "__fixtures__", "labels.codes.sps"), "utf8")
    );
  });

  test.each([
    ["codes", "zip-codes"],
    ["both", "zip-both"],
  ] as const)(
    "every CSV of Display answers %s matches its golden file byte for byte",
    async (display, folder) => {
      const entries = (await zipOf(display)).filter((entry) => entry.name.endsWith(".csv"));
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(
          entry.data.equals(readFileSync(join(__dirname, "__fixtures__", folder, entry.name))),
          entry.name
        ).toBe(true);
      }
    }
  );

  test("Text and code leaves no temporary file behind", async () => {
    const before = readdirSync(tmpdir()).filter((name) => name.startsWith("analysis-export-"));
    await zipOf("both");
    const after = readdirSync(tmpdir()).filter((name) => name.startsWith("analysis-export-"));
    expect(after).toEqual(before);
  });

  test("an error while reading rows fails the stream and leaves no temporary file", async () => {
    const before = readdirSync(tmpdir()).filter((name) => name.startsWith("analysis-export-"));
    const broken: TAnalysisExport = {
      ...buildSampleExport("both"),
      rows: async function* () {
        yield [];
        throw new Error("database went away");
      },
    };
    await expect(collect(createAnalysisZip(broken, { display: "both" }))).rejects.toThrow(
      "database went away"
    );
    const after = readdirSync(tmpdir()).filter((name) => name.startsWith("analysis-export-"));
    expect(after).toEqual(before);
  });

  test("rows are pulled one batch at a time: a consumer that stops reading stops the reader", async () => {
    let batches = 0;
    const endless: TAnalysisExport = {
      ...buildSampleExport("codes"),
      rows: async function* () {
        const [first] = await (async () => {
          for await (const batch of buildSampleExport("codes").rows()) return batch;
          return [];
        })();
        while (true) {
          batches++;
          yield Array.from({ length: 2000 }, () => first);
          if (batches > 5000) return;
        }
      },
    };
    const stream = createAnalysisZip(endless, { display: "codes" });
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    stream.destroy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(batches).toBeLessThan(200);
  });
});
