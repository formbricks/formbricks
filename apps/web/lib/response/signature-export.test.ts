import { describe, expect, test } from "vitest";
import * as xlsx from "xlsx";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { convertToCsv, convertToXlsxBuffer } from "@/lib/utils/file-conversion";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { extractSurveyDetails, getResponsesJson } from "./utils";

// The same chain `getResponseDownloadFile` runs: resolve storage URLs, build the rows, write the file.
// A Signature answer is one stored URL string (ADR 0016), so it must come out as one absolute URL cell
// under the element's headline, with no extra columns.

const RELATIVE_URL = "/storage/ws1/private/surveys/survey1/elements/sig1/signature--fid--abc.png";

const survey = {
  id: "survey1",
  name: "Contract",
  type: "link",
  workspaceId: "ws1",
  blocks: [
    {
      id: "b1",
      name: "Block 1",
      elements: [
        {
          id: "name1",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "Your name" },
          required: true,
        },
        {
          id: "sig1",
          type: TSurveyElementTypeEnum.Signature,
          headline: { default: "Sign here" },
          required: false,
          allowTypedSignature: true,
        },
      ],
    },
  ],
  questions: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  variables: [],
} as unknown as TSurvey;

const readSurvey = { ...survey, embeddedFields: embeddedFieldsFromLegacyInput(survey) } as unknown as TSurvey;

const response = (id: string, data: Record<string, unknown>) =>
  ({
    id,
    surveyId: "survey1",
    data,
    meta: {},
    contactAttributes: null,
    contact: null,
    finished: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    tags: [],
    variables: {},
    ttc: {},
  }) as unknown as TResponse;

const buildExport = () => {
  const responses = [
    response("r1", { name1: "Ada", sig1: RELATIVE_URL }),
    response("r2", { name1: "Grace", sig1: "" }),
    response("r3", { name1: "Linus" }),
  ];
  const { elements, metaDataFields } = extractSurveyDetails(readSurvey, responses);
  const resolved = responses.map((r) => ({ ...r, data: resolveStorageUrlsInObject(r.data) }));
  const rows = getResponsesJson(readSurvey, resolved as never, elements, []);
  const headers = [
    "No.",
    "Response ID",
    "Timestamp",
    "Finished",
    "Survey ID",
    "Formbricks ID (internal)",
    "User ID",
    "Tags",
    ...metaDataFields,
    ...elements.flat(),
  ];
  return { rows, headers, elements };
};

describe("Signature in CSV and Excel exports", () => {
  test("one column named after the element's headline, no extra columns", () => {
    const { elements } = buildExport();

    expect(elements).toEqual([["1. Your name"], ["2. Sign here"]]);
  });

  test("the cell holds the absolute URL, the skipped and missing answers hold nothing", () => {
    const { rows } = buildExport();

    const url = rows[0]["2. Sign here"] as string;
    expect(url).toMatch(/^https?:\/\/.+/);
    expect(url.endsWith(RELATIVE_URL)).toBe(true);
    expect(rows[0]["1. Your name"]).toBe("Ada");
    expect(rows[1]["2. Sign here"]).toBe("");
    expect(rows[2]["2. Sign here"]).toBe("");
  });

  test("CSV carries the URL in the Signature column", async () => {
    const { rows, headers } = buildExport();

    const csv = await convertToCsv(headers, rows);

    const [headerLine, firstRow] = csv.split("\n");
    expect(headerLine).toContain('"2. Sign here"');
    expect(firstRow).toMatch(/"https?:\/\/[^"]+signature--fid--abc\.png"/);
  });

  test("Excel carries the same URL in the same column", () => {
    const { rows, headers } = buildExport();

    const sheet = xlsx.read(convertToXlsxBuffer(headers, rows), { type: "buffer" });
    const cells = sheet.Sheets[sheet.SheetNames[0]];
    const column = headers.indexOf("2. Sign here");
    const cell = (row: number) => cells[xlsx.utils.encode_cell({ r: row, c: column })];

    expect(cell(0).v).toBe("2. Sign here");
    expect(cell(1).v).toMatch(/^https?:\/\/.+signature--fid--abc\.png$/);
    expect(cell(2).v).toBe("");
  });
});
