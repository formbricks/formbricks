import { describe, expect, test } from "vitest";
import { buildSampleExport } from "@/lib/analysis-export/__fixtures__/sample-export";
import { createAnalysisZip } from "@/lib/analysis-export/analysis-zip";
import { createRowCounter } from "./export-row-counter";

const toBuffer = async (stream: AsyncIterable<Buffer>): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const feed = (counter: ReturnType<typeof createRowCounter>, bytes: Uint8Array, size: number) => {
  for (let offset = 0; offset < bytes.length; offset += size)
    counter.write(bytes.subarray(offset, offset + size));
};

describe("createRowCounter", () => {
  test("a CSV has one row per line after the header, however the chunks cut the lines", () => {
    const seen: number[] = [];
    const counter = createRowCounter("csv", (rows) => seen.push(rows));
    feed(counter, new TextEncoder().encode("a,b\r\n1,2\r\n3,4\r\n5,6\r\n"), 5);
    expect(seen.at(-1)).toBe(3);
    expect(Math.min(...seen)).toBe(0);
  });

  test("a zip counts the rows of its first file while it arrives, in any chunk size", async () => {
    const exported = buildSampleExport("codes");
    const zip = await toBuffer(
      createAnalysisZip(exported, {
        display: "codes",
        include: { datamap: true, unmappedValues: true, spssSyntax: true },
      })
    );
    const total = exported.counts.included;
    expect(total).toBeGreaterThan(1);

    for (const size of [7, 64, zip.length]) {
      let rows = 0;
      feed(
        createRowCounter("zip", (count) => (rows = count)),
        zip,
        size
      );
      await expect.poll(() => rows).toBe(total);
    }
  });

  test("a zip whose first file is not deflated is not counted, and does not throw", () => {
    let rows = -1;
    const counter = createRowCounter("zip", (count) => (rows = count));
    expect(() => feed(counter, new Uint8Array(100), 10)).not.toThrow();
    expect(rows).toBe(-1);
  });
});
