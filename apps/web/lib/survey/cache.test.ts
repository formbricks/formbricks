import { cleanup } from "@testing-library/react";
import { revalidateTag } from "next/cache";
import { afterEach, describe, expect, test, vi } from "vitest";
import { surveyCache } from "./cache";

// Mock the revalidateTag function from next/cache
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

describe("surveyCache", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("tag methods", () => {
    test("byId returns the correct tag string", () => {
      const id = "survey-123";
      expect(surveyCache.tag.byId(id)).toBe(`surveys-${id}`);
    });

    test("byEnvironmentId returns the correct tag string", () => {
      const environmentId = "env-456";
      expect(surveyCache.tag.byEnvironmentId(environmentId)).toBe(`environments-${environmentId}-surveys`);
    });

    test("byAttributeClassId returns the correct tag string", () => {
      const attributeClassId = "attr-789";
      expect(surveyCache.tag.byAttributeClassId(attributeClassId)).toBe(
        `attributeFilters-${attributeClassId}-surveys`
      );
    });

    test("byActionClassId returns the correct tag string", () => {
      const actionClassId = "action-012";
      expect(surveyCache.tag.byActionClassId(actionClassId)).toBe(`actionClasses-${actionClassId}-surveys`);
    });

    test("bySegmentId returns the correct tag string", () => {
      const segmentId = "segment-345";
      expect(surveyCache.tag.bySegmentId(segmentId)).toBe(`segments-${segmentId}-surveys`);
    });

    test("byResultShareKey returns the correct tag string", () => {
      const resultShareKey = "share-678";
      expect(surveyCache.tag.byResultShareKey(resultShareKey)).toBe(`surveys-resultShare-${resultShareKey}`);
    });
  });

  describe("revalidate method", () => {
    test("calls revalidateTag with correct tag when id is provided", () => {
      const id = "survey-123";
      surveyCache.revalidate({ id });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`surveys-${id}`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    });

    test("calls revalidateTag with correct tag when attributeClassId is provided", () => {
      const attributeClassId = "attr-789";
      surveyCache.revalidate({ attributeClassId });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`attributeFilters-${attributeClassId}-surveys`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    });

    test("calls revalidateTag with correct tag when actionClassId is provided", () => {
      const actionClassId = "action-012";
      surveyCache.revalidate({ actionClassId });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`actionClasses-${actionClassId}-surveys`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    });

    test("calls revalidateTag with correct tag when environmentId is provided", () => {
      const environmentId = "env-456";
      surveyCache.revalidate({ environmentId });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`environments-${environmentId}-surveys`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    });

    test("calls revalidateTag with correct tag when segmentId is provided", () => {
      const segmentId = "segment-345";
      surveyCache.revalidate({ segmentId });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`segments-${segmentId}-surveys`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    });

    test("calls revalidateTag with correct tag when resultShareKey is provided", () => {
      const resultShareKey = "share-678";
      surveyCache.revalidate({ resultShareKey });
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`surveys-resultShare-${resultShareKey}`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    });

    test("calls revalidateTag multiple times when multiple parameters are provided", () => {
      const props = {
        id: "survey-123",
        environmentId: "env-456",
        attributeClassId: "attr-789",
        actionClassId: "action-012",
        segmentId: "segment-345",
        resultShareKey: "share-678",
      };

      surveyCache.revalidate(props);

      expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(6);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`surveys-${props.id}`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`environments-${props.environmentId}-surveys`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(
        `attributeFilters-${props.attributeClassId}-surveys`
      );
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`actionClasses-${props.actionClassId}-surveys`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`segments-${props.segmentId}-surveys`);
      expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`surveys-resultShare-${props.resultShareKey}`);
    });

    test("does not call revalidateTag when no parameters are provided", () => {
      surveyCache.revalidate({});
      expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
    });
  });
});
