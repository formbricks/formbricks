import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";

const ZGetDisplaysWithContactAction = z.object({
  surveyId: ZId,
  limit: z.number().int().min(1),
  offset: z.number().int().nonnegative(),
});

const mockSurveyId = "clqkr5smu000108jy50v6g5k4";

describe("ZGetDisplaysWithContactAction Schema Validation", () => {
  describe("Happy Path", () => {
    test("accepts valid positive limit and non-negative offset", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    test("accepts limit of 1 and offset of 0", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 1,
        offset: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(1);
        expect(result.data.offset).toBe(0);
      }
    });

    test("accepts large positive values", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 100,
        offset: 50,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
        expect(result.data.offset).toBe(50);
      }
    });
  });

  describe("Validation - Negative Values", () => {
    test("rejects negative limit", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: -1,
        offset: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("limit");
        expect(result.error.issues[0].message).toMatch(/greater than or equal to 1/i);
      }
    });

    test("rejects negative offset", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 10,
        offset: -5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("offset");
        expect(result.error.issues[0].message).toMatch(/greater than or equal to 0/i);
      }
    });

    test("rejects both negative limit and offset", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: -10,
        offset: -5,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("limit");
        expect(paths).toContain("offset");
      }
    });

    test("rejects zero limit (must be at least 1)", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 0,
        offset: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("limit");
        expect(result.error.issues[0].message).toMatch(/greater than or equal to 1/i);
      }
    });
  });

  describe("Validation - Non-Integer Values", () => {
    test("rejects decimal limit", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 10.5,
        offset: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("limit");
        expect(result.error.issues[0].message).toMatch(/integer/i);
      }
    });

    test("rejects decimal offset", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 10,
        offset: 5.7,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("offset");
        expect(result.error.issues[0].message).toMatch(/integer/i);
      }
    });

    test("rejects both decimal values", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 10.5,
        offset: 5.7,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain("limit");
        expect(paths).toContain("offset");
      }
    });
  });

  describe("Validation - Invalid surveyId", () => {
    test("rejects invalid surveyId format", () => {
      const result = ZGetDisplaysWithContactAction.safeParse({
        surveyId: "invalid-id",
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("surveyId");
      }
    });
  });

  describe("Edge Cases", () => {
    test("ensures Prisma skip/take receive valid integers", () => {
      const validResult = ZGetDisplaysWithContactAction.safeParse({
        surveyId: mockSurveyId,
        limit: 15,
        offset: 0,
      });

      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(Number.isInteger(validResult.data.limit)).toBe(true);
        expect(Number.isInteger(validResult.data.offset)).toBe(true);
        expect(validResult.data.limit).toBeGreaterThan(0);
        expect(validResult.data.offset).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
