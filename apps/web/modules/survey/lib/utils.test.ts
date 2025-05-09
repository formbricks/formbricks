import { describe, expect, test } from "vitest";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyFilterCriteria, TSurveyStatus, TSurveyType } from "@formbricks/types/surveys/types";
import { anySurveyHasFilters, buildOrderByClause, buildWhereClause, transformPrismaSurvey } from "./utils";

describe("Survey Utils", () => {
  describe("transformPrismaSurvey", () => {
    test("should transform a Prisma survey object with a segment", () => {
      const surveyPrisma = {
        id: "survey1",
        name: "Test Survey",
        displayPercentage: "50.5",
        segment: {
          id: "segment1",
          title: "Test Segment",
          filters: [],
          surveys: [{ id: "survey1" }, { id: "survey2" }],
        },
        // other survey properties
      };

      const expectedSegment = {
        id: "segment1",
        title: "Test Segment",
        filters: [],
        surveys: ["survey1", "survey2"],
      } as unknown as TSegment;

      const expectedTransformedSurvey: TSurvey = {
        id: "survey1",
        name: "Test Survey",
        displayPercentage: 50.5,
        segment: expectedSegment,
        // other survey properties
      } as TSurvey; // Cast to TSurvey to satisfy type checker for other missing props

      const result = transformPrismaSurvey<TSurvey>(surveyPrisma);
      expect(result.displayPercentage).toBe(expectedTransformedSurvey.displayPercentage);
      expect(result.segment).toEqual(expectedTransformedSurvey.segment);
      // Check other properties if necessary, ensuring they are passed through
      expect(result.id).toBe(expectedTransformedSurvey.id);
      expect(result.name).toBe(expectedTransformedSurvey.name);
    });

    test("should transform a Prisma survey object without a segment", () => {
      const surveyPrisma = {
        id: "survey2",
        name: "Another Survey",
        displayPercentage: "75",
        segment: null,
        // other survey properties
      };

      const expectedTransformedSurvey: TSurvey = {
        id: "survey2",
        name: "Another Survey",
        displayPercentage: 75,
        segment: null,
        // other survey properties
      } as TSurvey;

      const result = transformPrismaSurvey<TSurvey>(surveyPrisma);
      expect(result.displayPercentage).toBe(expectedTransformedSurvey.displayPercentage);
      expect(result.segment).toBeNull();
      expect(result.id).toBe(expectedTransformedSurvey.id);
      expect(result.name).toBe(expectedTransformedSurvey.name);
    });

    test("should handle null displayPercentage", () => {
      const surveyPrisma = {
        id: "survey3",
        name: "Survey with null percentage",
        displayPercentage: null,
        segment: null,
      };
      const result = transformPrismaSurvey<TSurvey>(surveyPrisma);
      expect(result.displayPercentage).toBeNull();
    });

    test("should handle undefined displayPercentage", () => {
      const surveyPrisma = {
        id: "survey4",
        name: "Survey with undefined percentage",
        displayPercentage: undefined,
        segment: null,
      };
      const result = transformPrismaSurvey<TSurvey>(surveyPrisma);
      expect(result.displayPercentage).toBeNull();
    });

    test("should transform for TJsEnvironmentStateSurvey type", () => {
      const surveyPrisma = {
        id: "surveyJs",
        name: "JS Survey",
        displayPercentage: "10.0",
        segment: null,
        // other specific TJsEnvironmentStateSurvey properties if any
      };
      const result = transformPrismaSurvey<TJsEnvironmentStateSurvey>(surveyPrisma);
      expect(result.displayPercentage).toBe(10.0);
      expect(result.segment).toBeNull();
      expect(result.id).toBe("surveyJs");
    });
  });

  describe("buildWhereClause", () => {
    test("should return an empty AND array if no filterCriteria is provided", () => {
      const result = buildWhereClause();
      expect(result).toEqual({ AND: [] });
    });

    test("should build where clause for name", () => {
      const filterCriteria: TSurveyFilterCriteria = { name: "Test Survey" };
      const result = buildWhereClause(filterCriteria);
      expect(result.AND).toContainEqual({ name: { contains: "Test Survey", mode: "insensitive" } });
    });

    test("should build where clause for status", () => {
      const filterCriteria: TSurveyFilterCriteria = { status: ["draft", "paused"] };
      const result = buildWhereClause(filterCriteria);
      expect(result.AND).toContainEqual({ status: { in: ["draft", "paused"] } });
    });

    test("should build where clause for type", () => {
      const filterCriteria: TSurveyFilterCriteria = { type: ["link", "app"] };
      const result = buildWhereClause(filterCriteria);
      expect(result.AND).toContainEqual({ type: { in: ["link", "app"] } });
    });

    test("should build where clause for createdBy 'you'", () => {
      const filterCriteria: TSurveyFilterCriteria = {
        createdBy: { value: ["you"], userId: "user123" },
      };
      const result = buildWhereClause(filterCriteria);
      expect(result.AND).toContainEqual({ createdBy: "user123" });
    });

    test("should build where clause for createdBy 'others'", () => {
      const filterCriteria: TSurveyFilterCriteria = {
        createdBy: { value: ["others"], userId: "user123" },
      };
      const result = buildWhereClause(filterCriteria);
      expect(result.AND).toContainEqual({
        OR: [
          {
            createdBy: {
              not: "user123",
            },
          },
          {
            createdBy: null,
          },
        ],
      });
    });

    test("should build where clause for multiple criteria", () => {
      const filterCriteria: TSurveyFilterCriteria = {
        name: "Feedback Survey",
        status: ["inProgress" as TSurveyStatus],
        type: ["app" as TSurveyType],
        createdBy: { value: ["you"], userId: "user456" },
      };
      const result = buildWhereClause(filterCriteria);
      expect(result.AND).toEqual([
        { name: { contains: "Feedback Survey", mode: "insensitive" } },
        { status: { in: ["inProgress" as TSurveyStatus] } },
        { type: { in: ["app" as TSurveyType] } },
        { createdBy: "user456" },
      ]);
    });

    test("should not add createdBy clause if value is empty or not 'you' or 'others'", () => {
      let filterCriteria: TSurveyFilterCriteria = { createdBy: { value: [], userId: "user123" } };
      let result = buildWhereClause(filterCriteria);
      expect(result.AND).not.toContainEqual(expect.objectContaining({ createdBy: expect.anything() }));

      filterCriteria = { createdBy: { value: ["others"], userId: "user123" } };
      result = buildWhereClause(filterCriteria);
      expect(result.AND).not.toContainEqual(expect.objectContaining({ createdBy: expect.anything() }));
    });
  });

  describe("buildOrderByClause", () => {
    test("should return undefined if no sortBy is provided", () => {
      const result = buildOrderByClause();
      expect(result).toBeUndefined();
    });

    test("should return orderBy clause for name", () => {
      const result = buildOrderByClause("name");
      expect(result).toEqual([{ name: "asc" }]);
    });

    test("should return orderBy clause for createdAt", () => {
      const result = buildOrderByClause("createdAt");
      expect(result).toEqual([{ createdAt: "desc" }]);
    });

    test("should return orderBy clause for updatedAt", () => {
      const result = buildOrderByClause("updatedAt");
      expect(result).toEqual([{ updatedAt: "desc" }]);
    });

    test("should default to updatedAt for unknown sortBy value", () => {
      const result = buildOrderByClause("invalidSortBy" as any);
      expect(result).toEqual([{ updatedAt: "desc" }]);
    });
  });

  describe("anySurveyHasFilters", () => {
    test("should return true if any survey has segment filters", () => {
      const surveys: TSurvey[] = [
        { id: "1", name: "Survey 1", segment: { id: "seg1", filters: [{ id: "f1" }] } } as TSurvey,
        { id: "2", name: "Survey 2", segment: null } as TSurvey,
      ];
      expect(anySurveyHasFilters(surveys)).toBe(true);
    });

    test("should return false if no survey has segment filters", () => {
      const surveys: TSurvey[] = [
        { id: "1", name: "Survey 1", segment: { id: "seg1", filters: [] } } as unknown as TSurvey,
        { id: "2", name: "Survey 2", segment: null } as TSurvey,
      ];
      expect(anySurveyHasFilters(surveys)).toBe(false);
    });

    test("should return false if surveys array is empty", () => {
      const surveys: TSurvey[] = [];
      expect(anySurveyHasFilters(surveys)).toBe(false);
    });

    test("should return false if segment is null or filters are undefined", () => {
      const surveys: TSurvey[] = [
        { id: "1", name: "Survey 1", segment: null } as TSurvey,
        { id: "2", name: "Survey 2", segment: { id: "seg2" } } as TSurvey, // filters undefined
      ];
      expect(anySurveyHasFilters(surveys)).toBe(false);
    });

    test("should handle surveys that are not TSurvey but TJsEnvironmentStateSurvey (no segment)", () => {
      const surveys = [
        { id: "js1", name: "JS Survey 1" }, // TJsEnvironmentStateSurvey like, no segment property
      ] as any[]; // Using any[] to simulate mixed types or types without segment
      expect(anySurveyHasFilters(surveys)).toBe(false);
    });
  });
});
