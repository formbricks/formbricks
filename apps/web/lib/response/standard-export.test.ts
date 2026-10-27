import { beforeEach, describe, expect, test, vi } from "vitest";
import * as xlsx from "xlsx";
import { prisma } from "@formbricks/database";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getOrganization } from "../organization/service";
import { getSurvey } from "../survey/service";
import { getResponseDownloadFile } from "./service";

/**
 * Pins the Standard export end to end: `getResponseDownloadFile` with the real header assembly, row
 * builder and CSV/XLSX writers. Only the database and the survey/organization lookups are stubbed, so a
 * change to any header, the encoding, the line endings or the sheet name fails here.
 *
 * The later export work (Analysis export, recoding) must leave this file byte-identical; these
 * assertions are the safety net for that.
 */

vi.mock("@formbricks/database", () => ({
  prisma: { response: { findMany: vi.fn() } },
}));

vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));

vi.mock("../survey/service", () => ({ getSurvey: vi.fn() }));

vi.mock("../organization/service", () => ({ getOrganization: vi.fn() }));

vi.mock("@/modules/survey/lib/organization", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(() => Promise.resolve("org-123")),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getOrganizationBilling: vi.fn(() => Promise.resolve({ limits: {} })),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsQuotasEnabled: vi.fn(() => Promise.resolve(false)),
}));

const language = (code: string, isDefault: boolean) => ({
  default: isDefault,
  enabled: true,
  language: {
    id: `lang-${code}`,
    code,
    alias: null,
    workspaceId: "ws-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

const buildSurvey = (): TSurvey => {
  const survey = {
    id: "survey-123",
    name: "Standard Export Survey",
    workspaceId: "ws-1",
    type: "link",
    isVerifyEmailEnabled: false,
    languages: [language("en", true), language("ar", false)],
    questions: [],
    hiddenFields: { enabled: false, fieldIds: [] },
    blocks: [
      {
        id: "block-1",
        name: "Block 1",
        elements: [
          {
            id: "q-text",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Your name", ar: "اسمك" },
            required: false,
          },
          {
            id: "q-single",
            type: TSurveyElementTypeEnum.MultipleChoiceSingle,
            headline: { default: "Favourite colour" },
            required: false,
            shuffleOption: "none",
            choices: [
              { id: "red", label: { default: "Red", ar: "أحمر" } },
              { id: "blue", label: { default: "Blue", ar: "أزرق" } },
            ],
          },
          {
            id: "q-multi",
            type: TSurveyElementTypeEnum.MultipleChoiceMulti,
            headline: { default: "Fruits" },
            required: false,
            shuffleOption: "none",
            choices: [
              { id: "apple", label: { default: "Apple", ar: "تفاح" } },
              { id: "pear", label: { default: "Pear", ar: "كمثرى" } },
            ],
          },
          {
            id: "q-rank",
            type: TSurveyElementTypeEnum.Ranking,
            headline: { default: "Rank these" },
            required: false,
            shuffleOption: "none",
            choices: [
              { id: "first", label: { default: "First", ar: "الأول" } },
              { id: "second", label: { default: "Second", ar: "الثاني" } },
            ],
          },
          {
            id: "q-matrix",
            type: TSurveyElementTypeEnum.Matrix,
            headline: { default: "Rate us" },
            required: false,
            shuffleOption: "none",
            rows: [
              { id: "speed", label: { default: "Speed", ar: "السرعة" } },
              { id: "quality", label: { default: "Quality", ar: "الجودة" } },
            ],
            columns: [
              { id: "good", label: { default: "Good", ar: "جيد" } },
              { id: "great", label: { default: "Great", ar: "ممتاز" } },
            ],
          },
        ],
      },
    ],
  };
  return { ...survey, embeddedFields: embeddedFieldsFromLegacyInput(survey) } as unknown as TSurvey;
};

const baseRow = {
  surveyId: "survey-123",
  updatedAt: new Date("2026-03-01T10:00:00.000Z"),
  finished: true,
  endingId: null,
  meta: {},
  ttc: {},
  variables: {},
  contactAttributes: {},
  singleUseId: null,
  displayId: null,
  contact: null,
  tags: [],
  quotaLinks: [],
};

const defaultLanguageRow = {
  ...baseRow,
  id: "response-en",
  createdAt: new Date("2026-03-01T10:00:00.000Z"),
  language: "default",
  data: {
    "q-text": "Alice",
    "q-single": "Red",
    "q-multi": ["Apple", "Pear"],
    "q-rank": ["Second", "First"],
    "q-matrix": { Speed: "Good", Quality: "Great" },
  },
};

const arabicRow = {
  ...baseRow,
  id: "response-ar",
  createdAt: new Date("2026-03-01T09:00:00.000Z"),
  language: "ar",
  data: {
    "q-text": "ليلى",
    "q-single": "أزرق",
    "q-multi": ["تفاح"],
    "q-rank": ["الثاني", "الأول"],
    "q-matrix": { السرعة: "جيد", الجودة: "ممتاز" },
  },
};

const download = (format: "csv" | "xlsx") => getResponseDownloadFile("survey-123", format);

const parseSheet = (base64: string) => {
  const wb = xlsx.read(Buffer.from(base64, "base64"), { type: "buffer" });
  return {
    sheetNames: wb.SheetNames,
    rows: xlsx.utils.sheet_to_json<string[]>(wb.Sheets["Sheet1"], { header: 1, defval: "", raw: false }),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSurvey).mockResolvedValue(buildSurvey());
  vi.mocked(getOrganization).mockResolvedValue({ displayTimeZone: "UTC" } as never);
  vi.mocked(prisma.response.findMany).mockResolvedValue([defaultLanguageRow, arabicRow] as never);
});

describe("Standard export file shape", () => {
  test("CSV has no byte-order mark, uses LF line endings and quotes every header", async () => {
    const { fileContents } = await download("csv");

    expect(fileContents.charCodeAt(0)).not.toBe(0xfeff);
    expect(fileContents.startsWith('"No.","Response ID","Timestamp","Finished","Survey ID",')).toBe(true);
    expect(fileContents).not.toContain("\r");
    // header + two responses, no trailing newline
    expect(fileContents.split("\n")).toHaveLength(3);
    expect(fileContents.endsWith("\n")).toBe(false);
  });

  test("XLSX is a single sheet named Sheet1", async () => {
    const { fileContents } = await download("xlsx");

    expect(parseSheet(fileContents).sheetNames).toEqual(["Sheet1"]);
  });

  test("CSV and XLSX carry the same header row", async () => {
    const csvHeader = (await download("csv")).fileContents.split("\n")[0];
    const xlsxHeader = parseSheet((await download("xlsx")).fileContents).rows[0];

    expect(csvHeader).toBe(xlsxHeader.map((h) => `"${h}"`).join(","));
  });
});

describe("Standard export headers", () => {
  test("the header row is the fixed columns, the metadata columns, then the question columns", async () => {
    const header = parseSheet((await download("xlsx")).fileContents).rows[0];

    expect(header.slice(0, 8)).toEqual([
      "No.",
      "Response ID",
      "Timestamp",
      "Finished",
      "Survey ID",
      "Formbricks ID (internal)",
      "User ID",
      "Tags",
    ]);
    // `N. headline`, plus `- Option ID` for single, multi and ranking, plus one column per matrix row.
    // This survey has no variables, hidden fields or person attributes, so these are the tail.
    expect(header.slice(header.indexOf("1. Your name"))).toEqual([
      "1. Your name",
      "2. Favourite colour",
      "2. Favourite colour - Option ID",
      "3. Fruits",
      "3. Fruits - Option ID",
      "4. Rank these",
      "4. Rank these - Option ID",
      "5. Rate us - Speed",
      "5. Rate us - Quality",
    ]);
  });
});

describe("Standard export cells", () => {
  test("single, multi and ranking questions write the stored text and the comma-separated Option IDs", async () => {
    const [header, ...rows] = parseSheet((await download("xlsx")).fileContents).rows;
    const cell = (rowIndex: number, column: string) => rows[rowIndex][header.indexOf(column)];

    // Rows follow the query order: newest first.
    expect(cell(0, "Response ID")).toBe("response-en");
    expect(cell(0, "2. Favourite colour")).toBe("Red");
    expect(cell(0, "2. Favourite colour - Option ID")).toBe("red");
    expect(cell(0, "3. Fruits - Option ID")).toBe("apple, pear");
    expect(cell(0, "4. Rank these - Option ID")).toBe("second, first");

    expect(cell(1, "Response ID")).toBe("response-ar");
    expect(cell(1, "2. Favourite colour")).toBe("أزرق");
    expect(cell(1, "2. Favourite colour - Option ID")).toBe("blue");
    expect(cell(1, "3. Fruits - Option ID")).toBe("apple");
    expect(cell(1, "4. Rank these - Option ID")).toBe("second, first");
  });
});

describe("Standard export matrix", () => {
  test("a matrix answered in the default language fills every row column", async () => {
    const [header, ...rows] = parseSheet((await download("xlsx")).fileContents).rows;

    expect(rows[0][header.indexOf("5. Rate us - Speed")]).toBe("Good");
    expect(rows[0][header.indexOf("5. Rate us - Quality")]).toBe("Great");
  });

  test("a matrix answered in Arabic fills every row column, under the default-language header", async () => {
    const [header, ...rows] = parseSheet((await download("xlsx")).fileContents).rows;

    expect(rows[1][header.indexOf("5. Rate us - Speed")]).toBe("جيد");
    expect(rows[1][header.indexOf("5. Rate us - Quality")]).toBe("ممتاز");
  });

  test("a matrix answered in Arabic exports its values in the CSV too", async () => {
    const lines = (await download("csv")).fileContents.split("\n");

    expect(lines[2].endsWith('"جيد","ممتاز"')).toBe(true);
  });
});
