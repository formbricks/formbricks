import { describe, expect, test } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { RESERVED_FIELD_CATALOG, deriveLegacyEmbeddedData } from "@formbricks/types/embedded-data-resolver";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  calculateTtcTotal,
  extractChoiceIdsFromResponse,
  extractSurveyDetails,
  generateAllPermutationsOfSubsets,
  getReservedFilterEntries,
  getResponseContactAttributes,
  getResponseHiddenFields,
  getResponseMeta,
  getResponsesFileName,
  getResponsesJson,
} from "./utils";
import { RESERVED_FILTER_LOCATORS, buildWhereClause } from "./where-clause";

/**
 * A survey as a reader actually receives it: `transformPrismaSurvey` inlines the EmbeddedData rows
 * next to the legacy columns, and since ENG-2412 those rows are the only thing the accessors read.
 * Fixtures that declare `variables` / `hiddenFields` alone describe a row nobody reads.
 */
const asRead = <T extends Partial<TSurvey>>(survey: T): T =>
  ({ ...survey, embeddedFields: deriveLegacyEmbeddedData(survey) }) as T;

describe("Response Utils", () => {
  describe("calculateTtcTotal", () => {
    test("should calculate total time correctly", () => {
      const ttc = {
        question1: 10,
        question2: 20,
        question3: 30,
      };
      const result = calculateTtcTotal(ttc);
      expect(result._total).toBe(60);
    });

    test("should handle empty ttc object", () => {
      const ttc = {};
      const result = calculateTtcTotal(ttc);
      expect(result._total).toBe(0);
    });
  });

  describe("buildWhereClause", () => {
    const mockSurvey: Partial<TSurvey> = asRead({
      id: "survey1",
      name: "Test Survey",
      blocks: [],
      questions: [],
      type: "app",
      hiddenFields: { enabled: true, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "env1",
      createdBy: "user1",
      status: "draft",
    });

    test("should build where clause with finished filter", () => {
      const filterCriteria = { finished: true };
      const result = buildWhereClause(mockSurvey as TSurvey, filterCriteria);
      expect(result.AND).toContainEqual({ finished: true });
    });

    test("should build where clause with date range", () => {
      const filterCriteria = {
        createdAt: {
          min: new Date("2024-01-01"),
          max: new Date("2024-12-31"),
        },
      };
      const result = buildWhereClause(mockSurvey as TSurvey, filterCriteria);
      expect(result.AND).toContainEqual({
        createdAt: {
          gte: new Date("2024-01-01"),
          lte: new Date("2024-12-31"),
        },
      });
    });

    test("should build where clause with tags", () => {
      const filterCriteria = {
        tags: {
          applied: ["tag1", "tag2"],
          notApplied: ["tag3"],
        },
      };
      const result = buildWhereClause(mockSurvey as TSurvey, filterCriteria);
      expect(result.AND).toHaveLength(1);
    });

    test("should build where clause with contact attributes", () => {
      const filterCriteria = {
        contactAttributes: {
          email: { op: "equals" as const, value: "test@example.com" },
        },
      };
      const result = buildWhereClause(mockSurvey as TSurvey, filterCriteria);
      expect(result.AND).toHaveLength(1);
    });

    test("should build where clause with contact attribute exclusions", () => {
      const filterCriteria = {
        contactAttributes: {
          email: { op: "notEquals" as const, value: "blocked@example.com" },
        },
      };
      const result = buildWhereClause(mockSurvey as TSurvey, filterCriteria);
      expect(result.AND).toEqual([
        {
          AND: [{ contactAttributes: { path: ["email"], not: "blocked@example.com" } }],
        },
      ]);
    });

    test("should build where clause with response IDs", () => {
      const result = buildWhereClause(mockSurvey as TSurvey, { responseIds: ["response1", "response2"] });
      expect(result.AND).toContainEqual({ id: { in: ["response1", "response2"] } });
    });

    test("should build where clause with quota filters", () => {
      const result = buildWhereClause(mockSurvey as TSurvey, {
        quotas: {
          quota1: { op: "screenedOutNotInQuota" },
          quota2: { op: "screenedIn" },
        },
      });

      expect(result.AND).toContainEqual({
        AND: [
          {
            NOT: {
              quotaLinks: {
                some: {
                  quotaId: "quota1",
                },
              },
            },
          },
          {
            quotaLinks: {
              some: {
                quotaId: "quota2",
                status: "screenedIn",
              },
            },
          },
        ],
      });
    });

    test("should omit empty quota filters", () => {
      const result = buildWhereClause(mockSurvey as TSurvey, { quotas: {} });
      expect(result.AND).toEqual([]);
    });
  });

  describe("buildWhereClause – others & meta filters", () => {
    const baseSurvey: Partial<TSurvey> = {
      id: "s1",
      name: "Survey",
      blocks: [],
      questions: [],
      type: "app",
      hiddenFields: { enabled: false, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "e1",
      createdBy: "u1",
      status: "inProgress",
    };

    test("others: equals & notEquals", () => {
      const criteria = {
        others: {
          Language: { op: "equals" as const, value: "en" },
          Region: { op: "notEquals" as const, value: "APAC" },
        },
      };
      const result = buildWhereClause(baseSurvey as TSurvey, criteria);
      expect(result.AND).toEqual([
        {
          AND: [{ language: "en" }, { region: { not: "APAC" } }],
        },
      ]);
    });

    test("meta: equals & notEquals map to userAgent paths", () => {
      const criteria = {
        meta: {
          browser: { op: "equals" as const, value: "Chrome" },
          os: { op: "notEquals" as const, value: "Windows" },
        },
      };
      const result = buildWhereClause(baseSurvey as TSurvey, criteria);
      expect(result.AND).toEqual([
        {
          AND: [
            { meta: { path: ["userAgent", "browser"], equals: "Chrome" } },
            { meta: { path: ["userAgent", "os"], not: "Windows" } },
          ],
        },
      ]);
    });

    test("meta: URL string comparison operations", () => {
      const testCases = [
        {
          name: "contains",
          criteria: { meta: { url: { op: "contains" as const, value: "example.com" } } },
          expected: { meta: { path: ["url"], string_contains: "example.com" } },
        },
        {
          name: "doesNotContain",
          criteria: { meta: { url: { op: "doesNotContain" as const, value: "test.com" } } },
          expected: { NOT: { meta: { path: ["url"], string_contains: "test.com" } } },
        },
        {
          name: "startsWith",
          criteria: { meta: { url: { op: "startsWith" as const, value: "https://" } } },
          expected: { meta: { path: ["url"], string_starts_with: "https://" } },
        },
        {
          name: "doesNotStartWith",
          criteria: { meta: { url: { op: "doesNotStartWith" as const, value: "http://" } } },
          expected: { NOT: { meta: { path: ["url"], string_starts_with: "http://" } } },
        },
        {
          name: "endsWith",
          criteria: { meta: { url: { op: "endsWith" as const, value: ".com" } } },
          expected: { meta: { path: ["url"], string_ends_with: ".com" } },
        },
        {
          name: "doesNotEndWith",
          criteria: { meta: { url: { op: "doesNotEndWith" as const, value: ".org" } } },
          expected: { NOT: { meta: { path: ["url"], string_ends_with: ".org" } } },
        },
      ];

      testCases.forEach(({ criteria, expected }) => {
        const result = buildWhereClause(baseSurvey as TSurvey, criteria);
        expect(result.AND).toEqual([{ AND: [expected] }]);
      });
    });
  });

  describe("buildWhereClause – data‐field filter operations", () => {
    const textSurvey: Partial<TSurvey> = {
      id: "s2",
      name: "TextSurvey",
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "qText",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Text Q" },
              required: false,
              isDraft: false,
              charLimit: {},
              inputType: "text",
            },
            {
              id: "qNum",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Num Q" },
              required: false,
              isDraft: false,
              charLimit: {},
              inputType: "number",
            },
          ],
        },
      ],
      questions: [],
      type: "app",
      hiddenFields: { enabled: false, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "e2",
      createdBy: "u2",
      status: "inProgress",
    };

    const ops: Array<[keyof TSurveyElementTypeEnum | string, any, any]> = [
      ["submitted", { op: "submitted" }, { path: ["qText"], not: Prisma.DbNull }],
      ["filledOut", { op: "filledOut" }, { path: ["qText"], not: [] }],
      ["skipped", { op: "skipped" }, "OR"],
      ["equals", { op: "equals", value: "foo" }, { path: ["qText"], equals: "foo" }],
      ["notEquals", { op: "notEquals", value: "bar" }, "NOT"],
      ["lessThan", { op: "lessThan", value: 5 }, { path: ["qNum"], lt: 5 }],
      ["lessEqual", { op: "lessEqual", value: 10 }, { path: ["qNum"], lte: 10 }],
      ["greaterThan", { op: "greaterThan", value: 1 }, { path: ["qNum"], gt: 1 }],
      ["greaterEqual", { op: "greaterEqual", value: 2 }, { path: ["qNum"], gte: 2 }],
      [
        "includesAll",
        { op: "includesAll", value: ["a", "b"] },
        { path: ["qText"], array_contains: ["a", "b"] },
      ],
    ];

    ops.forEach(([name, filter, expected]) => {
      test(name as string, () => {
        const result = buildWhereClause(textSurvey as TSurvey, {
          data: {
            [["submitted", "filledOut", "equals", "includesAll"].includes(name as string) ? "qText" : "qNum"]:
              filter,
          },
        });
        // for OR/NOT cases we just ensure the operator key exists
        if (expected === "OR" || expected === "NOT") {
          expect(JSON.stringify(result)).toMatch(
            new RegExp(name === "skipped" ? `"OR":\\s*\\[` : `"not":"${filter.value}"`)
          );
        } else {
          expect(result.AND).toEqual([
            {
              AND: [{ data: expected }],
            },
          ]);
        }
      });
    });

    test("uploaded & notUploaded", () => {
      const res1 = buildWhereClause(textSurvey as TSurvey, { data: { qText: { op: "uploaded" } } });
      expect(res1.AND).toContainEqual({
        AND: [{ data: { path: ["qText"], not: "skipped" } }],
      });

      const res2 = buildWhereClause(textSurvey as TSurvey, { data: { qText: { op: "notUploaded" } } });
      expect(JSON.stringify(res2)).toMatch(/"equals":"skipped"/);
      expect(JSON.stringify(res2)).toMatch(/"equals":{}/);
    });

    test("clicked, accepted & booked", () => {
      ["clicked", "accepted", "booked"].forEach((status) => {
        const key = status as "clicked" | "accepted" | "booked";
        const res = buildWhereClause(textSurvey as TSurvey, { data: { qText: { op: key } } });
        expect(res.AND).toEqual([{ AND: [{ data: { path: ["qText"], equals: status } }] }]);
      });
    });

    test("matrix", () => {
      const matrixSurvey: Partial<TSurvey> = {
        id: "s3",
        name: "MatrixSurvey",
        blocks: [
          {
            id: "block1",
            name: "Block 1",
            elements: [
              {
                id: "qM",
                type: TSurveyElementTypeEnum.Matrix,
                headline: { default: "Matrix" },
                required: false,
                rows: [{ id: "r1", label: { default: "R1" } }],
                columns: [{ id: "c1", label: { default: "C1" } }],
                shuffleOption: "none",
                isDraft: false,
              },
            ],
          },
        ],
        questions: [],
        type: "app",
        hiddenFields: { enabled: false, fieldIds: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: "e3",
        createdBy: "u3",
        status: "inProgress",
      };
      const res = buildWhereClause(matrixSurvey as TSurvey, {
        data: { qM: { op: "matrix", value: { R1: "foo" } } },
      });
      expect(res.AND).toEqual([
        {
          AND: [
            {
              data: { path: ["qM", "R1"], equals: "foo" },
            },
          ],
        },
      ]);
    });

    test("includesOne: multiple choice multi with other choice selected", () => {
      const choiceSurvey: Partial<TSurvey> = {
        id: "s4",
        name: "ChoiceSurvey",
        blocks: [
          {
            id: "block1",
            name: "Block 1",
            elements: [
              {
                id: "qMulti",
                type: TSurveyElementTypeEnum.MultipleChoiceMulti,
                headline: { default: "Pick many" },
                required: false,
                choices: [
                  { id: "a", label: { default: "A" } },
                  { id: "b", label: { default: "B" } },
                  { id: "other", label: { default: "Other" } },
                ],
                shuffleOption: "none",
                isDraft: false,
              },
            ],
          },
        ],
        questions: [],
        type: "app",
        hiddenFields: { enabled: false, fieldIds: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: "e4",
        createdBy: "u4",
        status: "inProgress",
      };

      const result = buildWhereClause(choiceSurvey as TSurvey, {
        data: { qMulti: { op: "includesOne", value: ["Other"] } },
      });

      expect(result.AND).toEqual([
        {
          AND: [
            {
              NOT: {
                OR: expect.arrayContaining([
                  { data: { path: ["qMulti"], equals: ["A"] } },
                  { data: { path: ["qMulti"], equals: ["B"] } },
                ]),
              },
            },
          ],
        },
      ]);
    });

    test("includesOne: multiple choice single with other choice selected", () => {
      const choiceSurvey: Partial<TSurvey> = {
        id: "s5",
        name: "SingleChoiceSurvey",
        blocks: [
          {
            id: "block1",
            name: "Block 1",
            elements: [
              {
                id: "qSingle",
                type: TSurveyElementTypeEnum.MultipleChoiceSingle,
                headline: { default: "Pick one" },
                required: false,
                choices: [
                  { id: "a", label: { default: "A" } },
                  { id: "b", label: { default: "B" } },
                  { id: "other", label: { default: "Other" } },
                ],
                shuffleOption: "none",
                isDraft: false,
              },
            ],
          },
        ],
        questions: [],
        type: "app",
        hiddenFields: { enabled: false, fieldIds: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceId: "e5",
        createdBy: "u5",
        status: "inProgress",
      };

      const result = buildWhereClause(choiceSurvey as TSurvey, {
        data: { qSingle: { op: "includesOne", value: ["Other"] } },
      });

      expect(result.AND).toEqual([
        {
          AND: [
            {
              AND: [
                { NOT: { data: { path: ["qSingle"], equals: "A" } } },
                { NOT: { data: { path: ["qSingle"], equals: "B" } } },
              ],
            },
          ],
        },
      ]);
    });

    test("includesOne: regular choice match", () => {
      const result = buildWhereClause(textSurvey as TSurvey, {
        data: { qText: { op: "includesOne", value: ["A", "B"] } },
      });

      expect(result.AND).toEqual([
        {
          AND: [
            {
              OR: [
                {
                  OR: [
                    { data: { path: ["qText"], array_contains: ["A"] } },
                    { data: { path: ["qText"], equals: "A" } },
                  ],
                },
                {
                  OR: [
                    { data: { path: ["qText"], array_contains: ["B"] } },
                    { data: { path: ["qText"], equals: "B" } },
                  ],
                },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe("buildWhereClause – reserved + variables filters (ENG-1848)", () => {
    const reservedSurvey = asRead({
      id: "s3",
      name: "ReservedSurvey",
      blocks: [],
      questions: [],
      type: "link",
      hiddenFields: { enabled: true, fieldIds: [] },
      variables: [{ id: "var_score", name: "score", type: "number" as const, value: 0 }],
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "e3",
      createdBy: "u3",
      status: "inProgress",
    }) as TSurvey;

    test("reserved string field filters its meta path with the catalog name", () => {
      const result = buildWhereClause(reservedSurvey, {
        reserved: { utmSource: { op: "equals", value: "newsletter" } },
      });
      expect(result.AND).toContainEqual({
        AND: [{ meta: { path: ["utmSource"], equals: "newsletter" } }],
      });
    });

    test("deviceType remaps to the stored userAgent.device path", () => {
      const result = buildWhereClause(reservedSurvey, {
        reserved: { deviceType: { op: "equals", value: "desktop" } },
      });
      expect(result.AND).toContainEqual({
        AND: [{ meta: { path: ["userAgent", "device"], equals: "desktop" } }],
      });
    });

    test("number-typed reserved field compares numerically", () => {
      const result = buildWhereClause(reservedSurvey, {
        reserved: { screenWidth: { op: "greaterThan", value: 1000 } },
      });
      expect(result.AND).toContainEqual({
        AND: [{ meta: { path: ["screenWidth"], gt: 1000 } }],
      });
    });

    test("negated text ops wrap in NOT, and notEquals also matches absent values", () => {
      const contains = buildWhereClause(reservedSurvey, {
        reserved: { pagePath: { op: "doesNotContain", value: "/checkout" } },
      });
      expect(contains.AND).toContainEqual({
        AND: [{ NOT: { meta: { path: ["pagePath"], string_contains: "/checkout" } } }],
      });

      const notEquals = buildWhereClause(reservedSurvey, {
        reserved: { country: { op: "notEquals", value: "DE" } },
      });
      // Prisma.DbNull stringifies to {}, hence the regex assertion (same trick as notUploaded above).
      expect(JSON.stringify(notEquals.AND)).toMatch(
        /"OR":\[\{"meta":\{"path":\["country"\],"not":"DE"\}\},\{"meta":\{"path":\["country"\],"equals":\{\}\}\}\]/
      );
    });

    test("isSet / isNotSet match presence via DbNull", () => {
      const isSet = buildWhereClause(reservedSurvey, { reserved: { utmSource: { op: "isSet" } } });
      expect(JSON.stringify(isSet.AND)).toMatch(/"meta":\{"path":\["utmSource"\],"not":\{\}\}/);

      const isNotSet = buildWhereClause(reservedSurvey, { reserved: { utmSource: { op: "isNotSet" } } });
      expect(JSON.stringify(isNotSet.AND)).toMatch(/"meta":\{"path":\["utmSource"\],"equals":\{\}\}/);
    });

    test("durationSeconds filters ttc._total milliseconds through Math.round windows", () => {
      const equals = buildWhereClause(reservedSurvey, {
        reserved: { durationSeconds: { op: "equals", value: 13 } },
      });
      expect(equals.AND).toContainEqual({
        AND: [
          {
            AND: [{ ttc: { path: ["_total"], gte: 12500 } }, { ttc: { path: ["_total"], lt: 13500 } }],
          },
        ],
      });

      // rounded > 60 starts at 60500ms (60499 rounds DOWN to 60), rounded < 60 ends below 59500.
      const greaterThan = buildWhereClause(reservedSurvey, {
        reserved: { durationSeconds: { op: "greaterThan", value: 60 } },
      });
      expect(greaterThan.AND).toContainEqual({ AND: [{ ttc: { path: ["_total"], gte: 60500 } }] });

      const lessThan = buildWhereClause(reservedSurvey, {
        reserved: { durationSeconds: { op: "lessThan", value: 60 } },
      });
      expect(lessThan.AND).toContainEqual({ AND: [{ ttc: { path: ["_total"], lt: 59500 } }] });
    });

    test("fails closed: shadowed, unknown, and type-mismatched conditions emit nothing", () => {
      // `url` is declared as an ingested field here, so the reserved read must never be queried.
      const shadowingSurvey = asRead({
        ...reservedSurvey,
        hiddenFields: { enabled: true, fieldIds: ["url"] },
      }) as TSurvey;
      const shadowed = buildWhereClause(shadowingSurvey, {
        reserved: { url: { op: "equals", value: "https://x.test" } },
      });
      expect(shadowed.AND).toContainEqual({ AND: [] });

      const unknown = buildWhereClause(reservedSurvey, {
        reserved: { notInCatalog: { op: "equals", value: "x" } },
      });
      expect(unknown.AND).toContainEqual({ AND: [] });

      // A text op on the number-typed duration entry has no meaningful translation.
      const mismatched = buildWhereClause(reservedSurvey, {
        reserved: { durationSeconds: { op: "contains", value: "6" } },
      });
      expect(mismatched.AND).toContainEqual({ AND: [] });
    });

    test("variables filter by computed storageKey, unknown keys emit nothing", () => {
      const known = buildWhereClause(reservedSurvey, {
        variables: { var_score: { op: "greaterEqual", value: 5 } },
      });
      expect(known.AND).toContainEqual({
        AND: [{ variables: { path: ["var_score"], gte: 5 } }],
      });

      const unknown = buildWhereClause(reservedSurvey, {
        variables: { not_a_variable: { op: "equals", value: 5 } },
      });
      expect(unknown.AND).toContainEqual({ AND: [] });
    });

    test("ingested string fields get text ops through the data group", () => {
      const result = buildWhereClause(reservedSurvey, {
        data: { plan: { op: "contains", value: "gold" } },
      });
      expect(result.AND).toContainEqual({
        AND: [{ data: { path: ["plan"], string_contains: "gold" } }],
      });

      const negated = buildWhereClause(reservedSurvey, {
        data: { plan: { op: "doesNotEndWith", value: "-trial" } },
      });
      expect(negated.AND).toContainEqual({
        AND: [{ NOT: { data: { path: ["plan"], string_ends_with: "-trial" } } }],
      });
    });

    test("anti-drift: every filterable catalog entry has a storage locator", () => {
      const filterableNames = RESERVED_FIELD_CATALOG.filter(
        (entry) => entry.display !== "none" || entry.name === "durationSeconds"
      ).map((entry) => entry.name);
      expect(filterableNames.length).toBeGreaterThan(0);
      for (const name of filterableNames) {
        expect(RESERVED_FILTER_LOCATORS[name], `catalog entry "${name}" has no filter locator`).toBeDefined();
      }
    });
  });

  describe("getReservedFilterEntries (ENG-1848)", () => {
    const baseSurvey = asRead({
      id: "s4",
      name: "FilterEntriesSurvey",
      blocks: [],
      questions: [],
      type: "link",
      hiddenFields: { enabled: true, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "e4",
      createdBy: "u4",
      status: "inProgress",
      isAnonymizeResponsesEnabled: false,
      isCaptureIpEnabled: true,
    }) as TSurvey;

    test("offers the table's display entries plus durationSeconds, never ids or startedAt", () => {
      const names = getReservedFilterEntries(baseSurvey).map((entry) => entry.name);
      expect(names).toContain("utmSource");
      expect(names).toContain("browser");
      expect(names).toContain("durationSeconds");
      for (const excluded of ["responseId", "surveyId", "finished", "startedAt", "finishedAt", "language"]) {
        expect(names).not.toContain(excluded);
      }
    });

    test("a declared field owns its name — the reserved entry is dropped", () => {
      const shadowingSurvey = asRead({
        ...baseSurvey,
        hiddenFields: { enabled: true, fieldIds: ["url"] },
      }) as TSurvey;
      const names = getReservedFilterEntries(shadowingSurvey).map((entry) => entry.name);
      expect(names).not.toContain("url");
      expect(names).toContain("pagePath");
    });

    test("anonymized surveys drop never-captured fields; ipAddress follows its capture toggle", () => {
      const anonymized = getReservedFilterEntries({
        ...baseSurvey,
        isAnonymizeResponsesEnabled: true,
      } as TSurvey).map((entry) => entry.name);
      for (const dropped of ["country", "browser", "os", "deviceType", "ipAddress"]) {
        expect(anonymized).not.toContain(dropped);
      }
      expect(anonymized).toContain("utmSource");

      const ipOff = getReservedFilterEntries({
        ...baseSurvey,
        isCaptureIpEnabled: false,
      } as TSurvey).map((entry) => entry.name);
      expect(ipOff).not.toContain("ipAddress");
      expect(ipOff).toContain("country");
    });
  });

  describe("getResponsesFileName", () => {
    test("should generate correct filename", () => {
      const surveyName = "Test Survey";
      const extension = "csv";
      const result = getResponsesFileName(surveyName, extension);
      expect(result).toContain("export-test_survey-");
    });
  });

  // TODO: Fix this test after the survey editor poc is merged
  describe("extractSurveyDetails", () => {
    const mockSurvey: Partial<TSurvey> = asRead({
      id: "survey1",
      name: "Test Survey",
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Question 1" },
              required: true,
              choices: [
                { id: "1", label: { default: "Option 1" } },
                { id: "2", label: { default: "Option 2" } },
              ],
              shuffleOption: "none",
              isDraft: false,
            },
            {
              id: "q2",
              type: TSurveyElementTypeEnum.Matrix,
              headline: { default: "Matrix Question" },
              required: true,
              rows: [
                { id: "r1", label: { default: "Row 1" } },
                { id: "r2", label: { default: "Row 2" } },
              ],
              columns: [
                { id: "c1", label: { default: "Column 1" } },
                { id: "c2", label: { default: "Column 2" } },
              ],
              shuffleOption: "none",
              isDraft: false,
            },
          ],
        },
      ],
      questions: [],
      type: "app",
      hiddenFields: { enabled: true, fieldIds: ["hidden1"] },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "env1",
      createdBy: "user1",
      status: "draft",
    });

    const mockResponses: Partial<TResponse>[] = [
      {
        id: "response1",
        surveyId: "survey1",
        data: {},
        meta: { userAgent: { browser: "Chrome" } },
        contactAttributes: { email: "test@example.com" },
        finished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      },
    ];

    test("should extract survey details correctly", () => {
      const result = extractSurveyDetails(mockSurvey as TSurvey, mockResponses as TResponse[]);
      // Catalog-derived, not first-response-derived: the header exists whatever any response holds.
      expect(result.metaDataFields).toContain("Browser");
      expect(result.metaDataFields).toContain("Utm Source");
      expect(result.metaDataFields).not.toContain("userAgent - browser");
      expect(result.elements).toHaveLength(2); // 1 regular question + 2 matrix rows
      expect(result.hiddenFields).toContain("hidden1");
      expect(result.userAttributes).toContain("email");
    });

    // ENG-1847: the reserved column set is catalog-derived and stable — the four decisions below
    // (stability, shadowing, anonymize, basics dedupe) are each a rule reused from elsewhere, pinned
    // here so the export cannot drift from the response table.
    describe("reserved export columns (ENG-1847)", () => {
      test("columns are stable: a first response with NO meta still yields every catalog header", () => {
        // The old derivation read the FIRST response's meta keys, so this exact input produced zero
        // meta columns — red under that implementation.
        const bareResponse = { ...mockResponses[0], meta: {} } as TResponse;
        const result = extractSurveyDetails(mockSurvey as TSurvey, [bareResponse]);

        expect(result.metaDataFields).toContain("Utm Source");
        expect(result.metaDataFields).toContain("Page Path");
        expect(result.metaDataFields).toContain("Locale");
      });

      test("a survey declaring `url` does not get the reserved Url column — declared owns the name", () => {
        const shadowedSurvey = asRead({
          ...mockSurvey,
          hiddenFields: { enabled: true, fieldIds: ["url", "hidden1"] },
        }) as TSurvey;

        const result = extractSurveyDetails(shadowedSurvey, mockResponses as TResponse[]);

        expect(result.metaDataFields).not.toContain("Url");
        expect(result.hiddenFields).toContain("url");
      });

      test("an anonymized survey omits the privacy-drop columns and keeps the rest", () => {
        const anonymizedSurvey = {
          ...(mockSurvey as TSurvey),
          isAnonymizeResponsesEnabled: true,
        } as TSurvey;

        const result = extractSurveyDetails(anonymizedSurvey, mockResponses as TResponse[]);

        expect(result.metaDataFields).not.toContain("Country");
        expect(result.metaDataFields).toContain("Utm Source");
      });

      test("facts the fixed basic columns already carry never become reserved columns", () => {
        const result = extractSurveyDetails(mockSurvey as TSurvey, mockResponses as TResponse[]);

        for (const doubled of ["Response Id", "Survey Id", "Finished", "Started At"]) {
          expect(result.metaDataFields).not.toContain(doubled);
        }
        // finishedAt/durationSeconds are NOT basics-covered — they must be columns.
        expect(result.metaDataFields).toContain("Finished At");
        expect(result.metaDataFields).toContain("Duration Seconds");
      });

      test("ipAddress is a column only when the survey captures it", () => {
        const withIp = { ...(mockSurvey as TSurvey), isCaptureIpEnabled: true } as TSurvey;
        const withoutIp = { ...(mockSurvey as TSurvey), isCaptureIpEnabled: false } as TSurvey;

        expect(extractSurveyDetails(withIp, mockResponses as TResponse[]).metaDataFields).toContain(
          "Ip Address"
        );
        expect(extractSurveyDetails(withoutIp, mockResponses as TResponse[]).metaDataFields).not.toContain(
          "Ip Address"
        );
      });
    });

    test("should collect contact attributes for link surveys too", () => {
      const linkSurvey = { ...mockSurvey, type: "link" } as TSurvey;
      const result = extractSurveyDetails(linkSurvey, mockResponses as TResponse[]);
      expect(result.userAttributes).toEqual(["email"]);
    });

    /**
     * ENG-1837: the export columns are built from the survey's Embedded Data definitions rather than
     * `variables` / `hiddenFields`. Both the grouping (variables labelled by name, hidden fields by
     * storage key) and the order inside each group are user-visible CSV/XLSX header order, so they
     * are asserted exactly, not by membership.
     */
    describe("Embedded Data columns", () => {
      // Legacy columns populated, join absent — `embeddedFields` is cleared explicitly because
      // `mockSurvey` carries the inlined rows a real read would have.
      const legacySurvey = {
        ...mockSurvey,
        variables: [
          { id: "clx0000000000000000000v2", name: "tier", type: "text", value: "" },
          { id: "clx0000000000000000000v1", name: "score", type: "number", value: 0 },
        ],
        hiddenFields: { enabled: true, fieldIds: ["utm_source", "hidden1"] },
        embeddedFields: undefined,
      } as unknown as TSurvey;

      test("reports no Embedded Data columns when the join is absent", () => {
        // ENG-2412 removed the legacy fallback, so the rows are the whole answer. A survey read
        // through a select that omits `selectSurveyEmbeddedDataLinks` exports no variable or hidden
        // field columns at all — which is why every reader's select has to carry that join.
        const result = extractSurveyDetails(legacySurvey, mockResponses as TResponse[]);

        expect(result.variables).toEqual([]);
        expect(result.hiddenFields).toEqual([]);
      });

      test("takes the column labels from the rows when the join is present", () => {
        const withRows = {
          ...legacySurvey,
          embeddedFields: [
            {
              field: {
                name: "renamed_tier",
                source: "computed",
                dataType: "string",
                defaultValue: "",
                locked: false,
              },
              link: { storageKey: "clx0000000000000000000v2" },
            },
            {
              field: {
                name: "score",
                source: "computed",
                dataType: "number",
                defaultValue: 0,
                locked: false,
              },
              link: { storageKey: "clx0000000000000000000v1" },
            },
            {
              field: {
                name: "utm_source",
                source: "ingested",
                dataType: "string",
                defaultValue: null,
                locked: false,
              },
              link: { storageKey: "utm_source" },
            },
          ],
        } as TSurvey;

        const result = extractSurveyDetails(withRows, mockResponses as TResponse[]);

        expect(result.variables).toEqual(["renamed_tier", "score"]);
        expect(result.hiddenFields).toEqual(["utm_source"]);
      });
    });
  });

  describe("getResponsesJson", () => {
    const mockSurvey: Partial<TSurvey> = asRead({
      id: "survey1",
      name: "Test Survey",
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Question 1" },
              required: true,
              choices: [
                { id: "1", label: { default: "Option 1" } },
                { id: "2", label: { default: "Option 2" } },
              ],
              shuffleOption: "none",
              isDraft: false,
            },
          ],
        },
      ],
      questions: [],
      type: "app",
      hiddenFields: { enabled: true, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "env1",
      createdBy: "user1",
      status: "draft",
    });

    const mockResponses: Partial<TResponse>[] = [
      {
        id: "response1",
        surveyId: "survey1",
        data: { q1: "answer1" },
        meta: { userAgent: { browser: "Chrome" } },
        contactAttributes: { email: "test@example.com" },
        finished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      },
    ];

    test("should generate correct JSON data", () => {
      const questionsHeadlines = [["1. Question 1"]];
      const userAttributes = ["email"];
      const hiddenFields: string[] = [];
      const result = getResponsesJson(
        mockSurvey as TSurvey,
        mockResponses as TResponse[],
        questionsHeadlines,
        userAttributes,
        hiddenFields,
        false
      );
      expect(result[0]["Response ID"]).toBe("response1");
      expect(result[0]["Browser"]).toBe("Chrome");
      expect(result[0]["1. Question 1"]).toBe("answer1");
      expect(result[0]["person.email"]).toBe("test@example.com");
    });

    test("reserved values are typed and projected: duration numeric, finishedAt ISO, url query redacted, absent empty", () => {
      const finishedAtDate = new Date("2026-08-30T10:00:00.000Z");
      const richResponse = {
        ...mockResponses[0],
        updatedAt: finishedAtDate,
        ttc: { _total: 12500 },
        meta: {
          ...mockResponses[0].meta,
          url: "https://example.com/pricing?email=leak@example.com",
        },
      } as unknown as TResponse;

      const result = getResponsesJson(
        mockSurvey as TSurvey,
        [richResponse] as TResponse[],
        [["1. Question 1"]],
        [],
        [],
        false
      );

      // number cell, seconds not milliseconds — real numeric in XLSX, not text
      expect(result[0]["Duration Seconds"]).toBe(13);
      expect(result[0]["Finished At"]).toBe("2026-08-30T10:00:00.000Z");
      // redactQuery is honoured on the export projection like every other projection
      expect(result[0]["Url"]).toBe("https://example.com/pricing");
      expect(String(result[0]["Url"])).not.toContain("leak@example.com");
      // a column whose value this response never captured is an empty cell, not a missing key
      expect(result[0]["Utm Source"]).toBe("");
    });

    test("an ingested number stays a number in the cell", () => {
      const surveyWithNumberField = asRead({
        ...mockSurvey,
        hiddenFields: { enabled: true, fieldIds: ["seats"] },
      }) as TSurvey;
      const response = {
        ...mockResponses[0],
        data: { ...mockResponses[0].data, seats: 12 },
      } as unknown as TResponse;

      const result = getResponsesJson(surveyWithNumberField, [response], [], [], ["seats"], false);

      expect(result[0]["seats"]).toBe(12);
    });

    test("a computed field the response never captured leaves an empty cell", () => {
      // resolveEmbeddedValue would substitute the declared default here — i.e. display a value the
      // respondent's run never produced. The export deliberately reads the raw slot instead.
      const surveyWithVariables = asRead({
        ...mockSurvey,
        variables: [{ id: "clx0000000000000000000v1", name: "score", type: "number", value: 5 }],
      }) as TSurvey;

      const result = getResponsesJson(
        surveyWithVariables,
        [{ ...mockResponses[0], variables: {} }] as TResponse[],
        [["1. Question 1"]],
        [],
        [],
        false
      );

      expect(result[0]).toHaveProperty("score");
      expect(result[0].score).toBeUndefined();
    });

    test("writes a captured computed value under the field's name, keyed by its storage key", () => {
      const surveyWithVariables = asRead({
        ...mockSurvey,
        variables: [{ id: "clx0000000000000000000v1", name: "score", type: "number", value: 5 }],
      }) as TSurvey;

      const result = getResponsesJson(
        surveyWithVariables,
        [{ ...mockResponses[0], variables: { clx0000000000000000000v1: 12 } }] as TResponse[],
        [["1. Question 1"]],
        [],
        [],
        false
      );

      expect(result[0].score).toBe(12);
    });

    test("should namespace person attributes for link surveys too", () => {
      const linkSurvey = { ...mockSurvey, type: "link" } as TSurvey;
      const responsesWithContact = [
        { ...mockResponses[0], contactAttributes: { plan: "pro", email: "linked@example.com" } },
      ] as TResponse[];
      const result = getResponsesJson(
        linkSurvey,
        responsesWithContact,
        [["1. Question 1"]],
        ["plan", "email"],
        [],
        false
      );
      expect(result[0]["person.plan"]).toBe("pro");
      expect(result[0]["person.email"]).toBe("linked@example.com");
    });
  });

  describe("getResponseContactAttributes", () => {
    test("should extract contact attributes correctly", () => {
      const responses = [
        {
          contactAttributes: { email: "test1@example.com", name: "Test 1" },
          data: {},
          meta: {},
        },
        {
          contactAttributes: { email: "test2@example.com", name: "Test 2" },
          data: {},
          meta: {},
        },
      ];
      const result = getResponseContactAttributes(
        responses as Pick<TResponse, "contactAttributes" | "data" | "meta">[]
      );
      expect(result.email).toContain("test1@example.com");
      expect(result.email).toContain("test2@example.com");
      expect(result.name).toContain("Test 1");
      expect(result.name).toContain("Test 2");
    });

    test("should handle empty responses", () => {
      const result = getResponseContactAttributes([]);
      expect(result).toEqual({});
    });
  });

  describe("getResponseMeta", () => {
    test("should extract meta data correctly", () => {
      const responses = [
        {
          contactAttributes: {},
          data: {},
          meta: {
            userAgent: { browser: "Chrome", os: "Windows" },
            country: "US",
          },
        },
        {
          contactAttributes: {},
          data: {},
          meta: {
            userAgent: { browser: "Firefox", os: "MacOS" },
            country: "UK",
          },
        },
      ];
      const result = getResponseMeta(responses as Pick<TResponse, "contactAttributes" | "data" | "meta">[]);
      expect(result.browser).toContain("Chrome");
      expect(result.browser).toContain("Firefox");
      expect(result.os).toContain("Windows");
      expect(result.os).toContain("MacOS");
    });

    test("should extract URL data correctly", () => {
      const responses = [
        {
          contactAttributes: {},
          data: {},
          meta: {
            url: "https://example.com/page1",
            source: "direct",
          },
        },
        {
          contactAttributes: {},
          data: {},
          meta: {
            url: "https://test.com/page2?param=value",
            source: "google",
          },
        },
      ];
      const result = getResponseMeta(responses as Pick<TResponse, "contactAttributes" | "data" | "meta">[]);
      expect(result.url).toEqual([]);
      expect(result.source).toContain("direct");
      expect(result.source).toContain("google");
    });

    test("should handle mixed meta data with URLs", () => {
      const responses = [
        {
          contactAttributes: {},
          data: {},
          meta: {
            userAgent: { browser: "Chrome", device: "desktop" },
            url: "https://formbricks.com/dashboard",
            country: "US",
          },
        },
        {
          contactAttributes: {},
          data: {},
          meta: {
            userAgent: { browser: "Safari", device: "mobile" },
            url: "https://formbricks.com/surveys/123",
            country: "UK",
          },
        },
      ];
      const result = getResponseMeta(responses as Pick<TResponse, "contactAttributes" | "data" | "meta">[]);
      expect(result.browser).toContain("Chrome");
      expect(result.browser).toContain("Safari");
      expect(result.device).toContain("desktop");
      expect(result.device).toContain("mobile");
      expect(result.url).toEqual([]);
      expect(result.country).toContain("US");
      expect(result.country).toContain("UK");
    });

    test("should handle empty responses", () => {
      const result = getResponseMeta([]);
      expect(result).toEqual({});
    });

    test("should ignore empty or null URL values", () => {
      const responses = [
        {
          contactAttributes: {},
          data: {},
          meta: {
            url: "",
            source: "direct",
          },
        },
        {
          contactAttributes: {},
          data: {},
          meta: {
            url: null as any,
            source: "newsletter",
          },
        },
        {
          contactAttributes: {},
          data: {},
          meta: {
            url: "https://valid.com",
            source: "google",
          },
        },
      ];
      const result = getResponseMeta(responses as Pick<TResponse, "contactAttributes" | "data" | "meta">[]);
      expect(result.url).toEqual([]);
      expect(result.source).toEqual(expect.arrayContaining(["direct", "newsletter", "google"]));
    });
  });

  describe("getResponseHiddenFields", () => {
    const mockSurvey: Partial<TSurvey> = asRead({
      id: "survey1",
      name: "Test Survey",
      questions: [],
      type: "app",
      hiddenFields: { enabled: true, fieldIds: ["hidden1", "hidden2"] },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "env1",
      createdBy: "user1",
      status: "draft",
    });

    test("should extract hidden fields correctly", () => {
      const responses = [
        {
          contactAttributes: {},
          data: { hidden1: "value1", hidden2: "value2" },
          meta: {},
        },
        {
          contactAttributes: {},
          data: { hidden1: "value3", hidden2: "value4" },
          meta: {},
        },
      ];
      const result = getResponseHiddenFields(
        mockSurvey as TSurvey,
        responses as Pick<TResponse, "contactAttributes" | "data" | "meta">[]
      );
      expect(result.hidden1).toContain("value1");
      expect(result.hidden1).toContain("value3");
      expect(result.hidden2).toContain("value2");
      expect(result.hidden2).toContain("value4");
    });

    test("should handle empty responses", () => {
      const result = getResponseHiddenFields(mockSurvey as TSurvey, []);
      expect(result).toEqual({
        hidden1: [],
        hidden2: [],
      });
    });
  });

  describe("generateAllPermutationsOfSubsets", () => {
    test("with empty array returns empty", () => {
      expect(generateAllPermutationsOfSubsets([])).toEqual([]);
    });

    test("with two elements returns 4 permutations", () => {
      const out = generateAllPermutationsOfSubsets(["x", "y"]);
      expect(out).toEqual(expect.arrayContaining([["x"], ["y"], ["x", "y"], ["y", "x"]]));
      expect(out).toHaveLength(4);
    });
  });
});

describe("extractChoiceIdsFromResponse", () => {
  const multipleChoiceMultiQuestion = {
    id: "multi-choice-id",
    type: TSurveyElementTypeEnum.MultipleChoiceMulti as typeof TSurveyElementTypeEnum.MultipleChoiceMulti,
    headline: { default: "Select multiple options" },
    required: false,
    choices: [
      {
        id: "choice-1",
        label: { default: "Option 1", es: "Opción 1" },
      },
      {
        id: "choice-2",
        label: { default: "Option 2", es: "Opción 2" },
      },
      {
        id: "choice-3",
        label: { default: "Option 3", es: "Opción 3" },
      },
    ],
    shuffleOption: "none" as const,
  };

  const multipleChoiceSingleQuestion = {
    id: "single-choice-id",
    type: TSurveyElementTypeEnum.MultipleChoiceSingle as typeof TSurveyElementTypeEnum.MultipleChoiceSingle,
    headline: { default: "Select one option" },
    required: false,
    choices: [
      {
        id: "choice-a",
        label: { default: "Choice A", fr: "Choix A" },
      },
      {
        id: "choice-b",
        label: { default: "Choice B", fr: "Choix B" },
      },
    ],
    shuffleOption: "none" as const,
  };

  const textQuestion = {
    id: "text-id",
    type: TSurveyElementTypeEnum.OpenText as typeof TSurveyElementTypeEnum.OpenText,
    headline: { default: "What do you think?" },
    required: false,
    inputType: "text" as const,
    charLimit: { enabled: false, min: 0, max: 0 },
  };

  describe("multipleChoiceMulti questions", () => {
    test("should extract choice IDs from array response with default language", () => {
      const responseValue = ["Option 1", "Option 3"];
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "default");

      expect(result).toEqual(["choice-1", "choice-3"]);
    });

    test("should extract choice IDs from array response with specific language", () => {
      const responseValue = ["Opción 1", "Opción 2"];
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "es");

      expect(result).toEqual(["choice-1", "choice-2"]);
    });

    test("should fall back to checking all language values when exact language match fails", () => {
      const responseValue = ["Opción 1", "Option 2"];
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "default");

      expect(result).toEqual(["choice-1", "choice-2"]);
    });

    test("should render other option when non-matching choice is selected", () => {
      const responseValue = ["Option 1", "Non-existent option", "Option 3"];
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "default");

      expect(result).toEqual(["choice-1", "other", "choice-3"]);
    });

    test("should return empty array for empty response", () => {
      const responseValue: string[] = [];
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "default");

      expect(result).toEqual([]);
    });
  });

  describe("multipleChoiceSingle questions", () => {
    test("should extract choice ID from string response with default language", () => {
      const responseValue = "Choice A";
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceSingleQuestion, "default");

      expect(result).toEqual(["choice-a"]);
    });

    test("should extract choice ID from string response with specific language", () => {
      const responseValue = "Choix B";
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceSingleQuestion, "fr");

      expect(result).toEqual(["choice-b"]);
    });

    test("should fall back to checking all language values for single choice", () => {
      const responseValue = "Choix A";
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceSingleQuestion, "default");

      expect(result).toEqual(["choice-a"]);
    });

    test("should return empty array for empty string response", () => {
      const responseValue = "";
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceSingleQuestion, "default");

      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    test("should return empty array for non-multiple choice questions", () => {
      const responseValue = "Some text response";
      const result = extractChoiceIdsFromResponse(responseValue, textQuestion, "default");

      expect(result).toEqual([]);
    });

    test("should handle missing language parameter by defaulting to 'default'", () => {
      const responseValue = "Option 1";
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion);

      expect(result).toEqual(["choice-1"]);
    });

    test("should handle numeric or other types by returning empty array", () => {
      const responseValue = 123;
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "default");

      expect(result).toEqual([]);
    });

    test("should handle object responses by returning empty array", () => {
      const responseValue = { invalid: "object" };
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "default");

      expect(result).toEqual([]);
    });
  });

  describe("language handling", () => {
    test("should use provided language parameter", () => {
      const responseValue = ["Opción 1"];
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, "es");

      expect(result).toEqual(["choice-1"]);
    });

    test("should handle null language parameter by defaulting to 'default'", () => {
      const responseValue = ["Option 1"];
      const result = extractChoiceIdsFromResponse(responseValue, multipleChoiceMultiQuestion, null as any);

      expect(result).toEqual(["choice-1"]);
    });

    test("should handle undefined language parameter by defaulting to 'default'", () => {
      const responseValue = ["Option 1"];
      const result = extractChoiceIdsFromResponse(
        responseValue,
        multipleChoiceMultiQuestion,
        undefined as any
      );

      expect(result).toEqual(["choice-1"]);
    });
  });
});
