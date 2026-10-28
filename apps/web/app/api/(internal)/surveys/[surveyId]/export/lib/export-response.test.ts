import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildSampleExport, sampleSurvey } from "@/lib/analysis-export/__fixtures__/sample-export";
import {
  ExportCancelledError,
  buildExportResponse,
  countExportResponses,
  stopWhenAborted,
} from "./export-response";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  getResponseDownloadFile: vi.fn(),
  openAnalysisExport: vi.fn(),
  cap: { value: undefined as number | undefined },
}));

vi.mock("./export-limits", () => ({
  get EXCEL_EXPORT_MAX_CELLS() {
    return mocks.cap.value;
  },
}));

vi.mock("@formbricks/database", () => ({ prisma: { response: { count: mocks.count } } }));
vi.mock("@/lib/response/service", () => ({ getResponseDownloadFile: mocks.getResponseDownloadFile }));
vi.mock("@/lib/response/where-clause", () => ({ buildWhereClause: () => ({ finished: true }) }));
vi.mock("@/lib/analysis-export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-export")>()),
  openAnalysisExport: mocks.openAnalysisExport,
}));

const signal = new AbortController().signal;
const survey = { ...sampleSurvey, name: "My Survey" } as never;
const baseArgs = { survey, isQuotasAllowed: false, timeZone: "UTC", signal };

const analysisPlan = (display: "codes" | "both", output: "csv" | "xlsx") =>
  ({
    kind: "analysis",
    format: output === "xlsx" ? "xlsx" : "csv",
    display,
    output,
    include: { datamap: false, unmappedValues: false, spssSyntax: false },
  }) as const;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cap.value = undefined;
});

describe("countExportResponses", () => {
  test("the Standard export counts every matching response and leaves none out", async () => {
    mocks.count.mockResolvedValue(9);
    const counts = await countExportResponses({
      survey: sampleSurvey as never,
      plan: { kind: "standard", format: "csv" },
    });
    expect(counts).toMatchObject({ included: 9, lowQualityLeftOut: 0, total: 9, excel: null });
    expect(mocks.count).toHaveBeenCalledWith({ where: { surveyId: sampleSurvey.id, finished: true } });
    expect(mocks.count).toHaveBeenCalledWith({ where: { surveyId: sampleSurvey.id } });
  });

  test("the Standard export lists its columns for the picker, one entry per question", async () => {
    mocks.count.mockResolvedValue(1);
    const { columnGroups } = await countExportResponses({
      survey: sampleSurvey as never,
      plan: { kind: "standard", format: "csv" },
    });
    expect(columnGroups.slice(0, 3)).toEqual([
      { id: "no", label: "no." },
      { id: "responseId", label: "responseId" },
      { id: "timestamp", label: "timestamp" },
    ]);
    expect(columnGroups.some((group) => group.id.startsWith("q:"))).toBe(true);
  });

  test("an Analysis export lists its own columns", async () => {
    mocks.count.mockResolvedValue(1);
    const { columnGroups } = await countExportResponses({
      survey: sampleSurvey as never,
      plan: analysisPlan("codes", "csv"),
    });
    expect(columnGroups[0]).toEqual({ id: "r:response_id", label: "responseId" });
  });

  test("an Analysis export counts without Low quality and reports how many it leaves out", async () => {
    mocks.count.mockImplementation(
      async ({ where }: { where: { AND?: [unknown, { outcome: unknown }] } }) => {
        if (!where.AND) return 20;
        return where.AND[1].outcome === null ? 8 : 3;
      }
    );
    const plan = {
      kind: "analysis",
      format: "csv",
      display: "codes",
      output: "csv",
      include: { datamap: false, unmappedValues: false, spssSyntax: false },
    } as const;
    expect(await countExportResponses({ survey: sampleSurvey as never, plan })).toMatchObject({
      included: 8,
      lowQualityLeftOut: 3,
      total: 20,
    });
  });

  test("a filter that selects Low quality leaves nothing out", async () => {
    mocks.count.mockResolvedValue(4);
    const plan = {
      kind: "analysis",
      format: "csv",
      display: "codes",
      output: "csv",
      include: { datamap: false, unmappedValues: false, spssSyntax: false },
    } as const;
    expect(
      await countExportResponses({ survey: sampleSurvey as never, plan, filter: { outcome: "lowQuality" } })
    ).toMatchObject({
      included: 4,
      lowQualityLeftOut: 0,
    });
  });

  describe("the Excel size an Analysis export would have", () => {
    const sampleCount = (display: "codes" | "both", cap: number | undefined) => {
      mocks.cap.value = cap;
      mocks.count.mockResolvedValue(8);
      return countExportResponses({
        survey: sampleSurvey as never,
        plan: analysisPlan(display, "csv"),
      });
    };

    test("is the data sheets' cells, whichever format is chosen, against the cap", async () => {
      // one data sheet: columns x (8 responses + header), so the cells are a multiple of 9
      const cells = (await sampleCount("codes", undefined)).excel?.cells ?? 0;
      expect(cells).toBeGreaterThan(0);
      expect(cells % 9).toBe(0);
      expect((await sampleCount("codes", cells)).excel).toEqual({ cells, maxCells: cells, tooLarge: false });
      expect((await sampleCount("codes", cells - 1)).excel?.tooLarge).toBe(true);
    });

    test("Text and code is two sheets", async () => {
      const one = (await sampleCount("codes", undefined)).excel?.cells ?? 0;
      expect((await sampleCount("both", undefined)).excel?.cells).toBe(2 * one);
    });

    test("with no cap nothing is too large and the cap reads null", async () => {
      expect((await sampleCount("codes", undefined)).excel).toMatchObject({
        maxCells: null,
        tooLarge: false,
      });
    });
  });
});

describe("buildExportResponse", () => {
  test("the Standard CSV is the existing path's bytes, untouched", async () => {
    mocks.getResponseDownloadFile.mockResolvedValue({
      fileContents: 'No.,Response ID\n"1","r1"',
      fileName: "export-my-survey-2026-10-27-00-00-00.csv",
    });
    const result = await buildExportResponse({
      ...baseArgs,
      plan: { kind: "standard", format: "csv" },
      filter: { responseIds: ["a"] },
    });
    if (!result.ok) throw new Error("expected a file");
    expect(mocks.getResponseDownloadFile).toHaveBeenCalledWith(
      sampleSurvey.id,
      "csv",
      { responseIds: ["a"] },
      []
    );
    expect(await result.response.text()).toBe('No.,Response ID\n"1","r1"');
    expect(mocks.openAnalysisExport).not.toHaveBeenCalled();
    expect(result.response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="export-my-survey-2026-10-27-00-00-00.csv"'
    );
  });

  test("columns switched off in the modal reach the Standard export as group ids", async () => {
    mocks.getResponseDownloadFile.mockResolvedValue({ fileContents: "x", fileName: "x.csv" });
    await buildExportResponse({
      ...baseArgs,
      plan: { kind: "standard", format: "csv" },
      excludedColumns: ["no", "tags"],
    });
    expect(mocks.getResponseDownloadFile).toHaveBeenCalledWith(sampleSurvey.id, "csv", undefined, [
      "no",
      "tags",
    ]);
  });

  test("with every column switched off there is nothing to export", async () => {
    const every = (
      await countExportResponses({ survey: sampleSurvey as never, plan: { kind: "standard", format: "csv" } })
    ).columnGroups.map((group) => group.id);
    const result = await buildExportResponse({
      ...baseArgs,
      plan: { kind: "standard", format: "csv" },
      excludedColumns: every,
    });
    expect(result).toMatchObject({ ok: false, reason: "no_columns" });
    expect(mocks.getResponseDownloadFile).not.toHaveBeenCalled();
  });

  test("an Analysis export drops the columns of a switched-off group", async () => {
    mocks.openAnalysisExport.mockResolvedValue(buildSampleExport("codes"));
    const result = await buildExportResponse({
      ...baseArgs,
      plan: analysisPlan("codes", "csv"),
      excludedColumns: ["r:language", "r:outcome"],
    });
    if (!result.ok) throw new Error("expected a file");
    const header = (await result.response.text()).split("\n")[0];
    expect(header).toContain("response_id");
    expect(header).not.toContain("language");
    expect(header).not.toContain("outcome");
  });

  test("the Standard Excel file is the base64 the existing path built, decoded", async () => {
    mocks.getResponseDownloadFile.mockResolvedValue({
      fileContents: Buffer.from([1, 2, 3, 250]).toString("base64"),
      fileName: "x.xlsx",
    });
    const result = await buildExportResponse({
      ...baseArgs,
      plan: { kind: "standard", format: "xlsx" },
    });
    if (!result.ok) throw new Error("expected a file");
    expect([...new Uint8Array(await result.response.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  test("a Code only CSV streams: BOM, header, then one row per response", async () => {
    mocks.openAnalysisExport.mockResolvedValue(buildSampleExport("codes"));
    const result = await buildExportResponse({
      ...baseArgs,
      plan: {
        kind: "analysis",
        format: "csv",
        display: "codes",
        output: "csv",
        include: { datamap: false, unmappedValues: false, spssSyntax: false },
      },
    });
    if (!result.ok) throw new Error("expected a file");
    const bytes = new Uint8Array(await result.response.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(4);
    expect(mocks.openAnalysisExport).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: sampleSurvey.id, answers: "codes" })
    );
    expect(result.response.headers.get("Content-Disposition")).toMatch(/\.csv"$/);
  });
});

describe("buildExportResponse Excel cap", () => {
  const run = (cap: number | undefined) => {
    mocks.cap.value = cap;
    mocks.openAnalysisExport.mockResolvedValue(buildSampleExport("both"));
    return buildExportResponse({ ...baseArgs, plan: analysisPlan("both", "xlsx") });
  };

  test("a workbook over the cap is refused before any row is read, and the message points to CSV", async () => {
    const result = await run(10);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("excel_too_large");
    expect(result.message).toMatch(/CSV/);
    expect(result.message).toContain("10");
  });

  test("a workbook within the cap is built", async () => {
    const result = await run(10_000);
    expect(result.ok).toBe(true);
  });
});

describe("stopWhenAborted", () => {
  test("stops reading once the client is gone", async () => {
    const controller = new AbortController();
    const exported = stopWhenAborted(buildSampleExport("codes"), controller.signal);
    const batches = exported.rows();
    await batches.next();
    controller.abort();
    await expect(batches.next()).rejects.toBeInstanceOf(ExportCancelledError);
  });
});
