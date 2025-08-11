import { Prisma } from "@prisma/client";
import { describe, expect, test } from "vitest";
import { TResponse } from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import {
  buildWhereClause,
  calculateTtcTotal,
  extracMetadataKeys,
  extractChoiceIdsFromResponse,
  extractSurveyDetails,
  generateAllPermutationsOfSubsets,
  getResponseContactAttributes,
  getResponseHiddenFields,
  getResponseMeta,
  getResponsesFileName,
  getResponsesJson,
} from "./utils";

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
    const mockSurvey: Partial<TSurvey> = {
      id: "survey1",
      name: "Test Survey",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Question 1" },
          required: true,
          choices: [
            { id: "1", label: { default: "Option 1" } },
            { id: "other", label: { default: "Other" } },
          ],
          shuffleOption: "none",
          isDraft: false,
        },
      ],
      type: "app",
      hiddenFields: { enabled: true, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      createdBy: "user1",
      status: "draft",
    };

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
  });

  describe("buildWhereClause – others & meta filters", () => {
    const baseSurvey: Partial<TSurvey> = {
      id: "s1",
      name: "Survey",
      questions: [],
      type: "app",
      hiddenFields: { enabled: false, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "e1",
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
  });

  describe("buildWhereClause – data‐field filter operations", () => {
    const textSurvey: Partial<TSurvey> = {
      id: "s2",
      name: "TextSurvey",
      questions: [
        {
          id: "qText",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Text Q" },
          required: false,
          isDraft: false,
          charLimit: {},
          inputType: "text",
        },
        {
          id: "qNum",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Num Q" },
          required: false,
          isDraft: false,
          charLimit: {},
          inputType: "number",
        },
      ],
      type: "app",
      hiddenFields: { enabled: false, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "e2",
      createdBy: "u2",
      status: "inProgress",
    };

    const ops: Array<[keyof TSurveyQuestionTypeEnum | string, any, any]> = [
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
        questions: [
          {
            id: "qM",
            type: TSurveyQuestionTypeEnum.Matrix,
            headline: { default: "Matrix" },
            required: false,
            rows: [{ default: "R1" }],
            columns: [{ default: "C1" }],
            shuffleOption: "none",
            isDraft: false,
          },
        ],
        type: "app",
        hiddenFields: { enabled: false, fieldIds: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "e3",
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
  });

  describe("getResponsesFileName", () => {
    test("should generate correct filename", () => {
      const surveyName = "Test Survey";
      const extension = "csv";
      const result = getResponsesFileName(surveyName, extension);
      expect(result).toContain("export-test_survey-");
    });
  });

  describe("extracMetadataKeys", () => {
    test("should extract metadata keys correctly", () => {
      const meta = {
        userAgent: { browser: "Chrome", os: "Windows", device: "Desktop" },
        country: "US",
        source: "direct",
      };
      const result = extracMetadataKeys(meta);
      expect(result).toContain("userAgent - browser");
      expect(result).toContain("userAgent - os");
      expect(result).toContain("userAgent - device");
      expect(result).toContain("country");
      expect(result).toContain("source");
    });

    test("should handle empty metadata", () => {
      const result = extracMetadataKeys({});
      expect(result).toEqual([]);
    });
  });

  describe("extractSurveyDetails", () => {
    const mockSurvey: Partial<TSurvey> = {
      id: "survey1",
      name: "Test Survey",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
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
          type: TSurveyQuestionTypeEnum.Matrix,
          headline: { default: "Matrix Question" },
          required: true,
          rows: [{ default: "Row 1" }, { default: "Row 2" }],
          columns: [{ default: "Column 1" }, { default: "Column 2" }],
          shuffleOption: "none",
          isDraft: false,
        },
      ],
      type: "app",
      hiddenFields: { enabled: true, fieldIds: ["hidden1"] },
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      createdBy: "user1",
      status: "draft",
    };

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
      expect(result.metaDataFields).toContain("userAgent - browser");
      expect(result.questions).toHaveLength(2); // 1 regular question + 2 matrix rows
      expect(result.hiddenFields).toContain("hidden1");
      expect(result.userAttributes).toContain("email");
    });
  });

  describe("getResponsesJson", () => {
    const mockSurvey: Partial<TSurvey> = {
      id: "survey1",
      name: "Test Survey",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
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
      type: "app",
      hiddenFields: { enabled: true, fieldIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      createdBy: "user1",
      status: "draft",
    };

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
        hiddenFields
      );
      expect(result[0]["Response ID"]).toBe("response1");
      expect(result[0]["userAgent - browser"]).toBe("Chrome");
      expect(result[0]["1. Question 1"]).toBe("answer1");
      expect(result[0]["email"]).toBe("test@example.com");
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

    test("should handle empty responses", () => {
      const result = getResponseMeta([]);
      expect(result).toEqual({});
    });
  });

  describe("getResponseHiddenFields", () => {
    const mockSurvey: Partial<TSurvey> = {
      id: "survey1",
      name: "Test Survey",
      questions: [],
      type: "app",
      hiddenFields: { enabled: true, fieldIds: ["hidden1", "hidden2"] },
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      createdBy: "user1",
      status: "draft",
    };

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
  const multipleChoiceMultiQuestion: TSurveyQuestion = {
    id: "multi-choice-id",
    type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
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
  };

  const multipleChoiceSingleQuestion: TSurveyQuestion = {
    id: "single-choice-id",
    type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
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
  };

  const textQuestion: TSurveyOpenTextQuestion = {
    id: "text-id",
    type: TSurveyQuestionTypeEnum.OpenText,
    headline: { default: "What do you think?" },
    required: false,
    inputType: "text",
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
