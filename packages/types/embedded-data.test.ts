import { describe, expect, test } from "vitest";
import { ZEmbeddedData, ZSurveyEmbeddedData } from "./embedded-data";

const localField = {
  id: "clx000000000000000000001",
  createdAt: new Date(),
  updatedAt: new Date(),
  key: null,
  name: "score",
  description: null,
  source: "computed" as const,
  dataType: "number" as const,
  defaultValue: 0,
  locked: false,
  isLocal: true,
  surveyId: "clx000000000000000000002",
  workspaceId: "clx000000000000000000003",
};

const sharedField = {
  ...localField,
  key: "weighted_score",
  isLocal: false,
  surveyId: null,
};

/** Collects the `path[0]` of every issue so tests can assert which field was rejected. */
const failedPaths = (input: unknown): string[] => {
  const result = ZEmbeddedData.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => String(issue.path[0]));
};

describe("ZEmbeddedData", () => {
  test("accepts a local field and a shared field", () => {
    expect(ZEmbeddedData.safeParse(localField).success).toBe(true);
    expect(ZEmbeddedData.safeParse(sharedField).success).toBe(true);
  });

  describe("local / shared invariant", () => {
    test("rejects a local field without a survey", () => {
      expect(failedPaths({ ...localField, surveyId: null })).toContain("surveyId");
    });

    test("rejects a local field that also has a library key", () => {
      expect(failedPaths({ ...localField, key: "score" })).toContain("key");
    });

    test("rejects a shared field without a library key", () => {
      expect(failedPaths({ ...sharedField, key: null })).toContain("key");
    });

    test("rejects a shared field that belongs to a survey", () => {
      expect(failedPaths({ ...sharedField, surveyId: "clx000000000000000000002" })).toContain("surveyId");
    });
  });

  describe("key naming rule", () => {
    test.each([
      ["Brand", "uppercase"],
      ["page-type", "hyphen"],
      ["1st_page", "leading digit"],
      ["page type", "space"],
    ])("rejects %s (%s)", (key) => {
      expect(failedPaths({ ...sharedField, key })).toContain("key");
    });

    test("accepts lowercase letters, digits and underscores", () => {
      expect(ZEmbeddedData.safeParse({ ...sharedField, key: "page_type_2" }).success).toBe(true);
    });
  });

  describe("source guards", () => {
    test("rejects locked on a computed field", () => {
      expect(failedPaths({ ...localField, locked: true })).toContain("locked");
    });

    test("accepts locked on an ingested field", () => {
      const ingested = {
        ...localField,
        source: "ingested" as const,
        dataType: "string" as const,
        defaultValue: "web",
        locked: true,
      };
      expect(ZEmbeddedData.safeParse(ingested).success).toBe(true);
    });

    test("rejects a default value on a reserved field", () => {
      const reserved = {
        ...localField,
        source: "reserved" as const,
        dataType: "string" as const,
        defaultValue: "DE",
      };
      expect(failedPaths(reserved)).toContain("defaultValue");
    });

    test.each(["boolean", "date"] as const)("rejects a computed field typed as %s", (dataType) => {
      // The logic engine only calculates strings and numbers.
      expect(failedPaths({ ...localField, dataType, defaultValue: null })).toContain("dataType");
    });

    test.each(["string", "number"] as const)("accepts a computed field typed as %s", (dataType) => {
      const value = dataType === "number" ? 0 : "";
      expect(ZEmbeddedData.safeParse({ ...localField, dataType, defaultValue: value }).success).toBe(true);
    });
  });
});

describe("ZSurveyEmbeddedData", () => {
  const link = {
    id: "clx000000000000000000004",
    surveyId: "clx000000000000000000002",
    embeddedDataId: "clx000000000000000000001",
    storageKey: "plan",
  };

  test("accepts a link", () => {
    expect(ZSurveyEmbeddedData.safeParse(link).success).toBe(true);
  });

  test.each([
    ["clx000000000000000000005", "a computed field's cuid"],
    ["Brand-Name", "a legacy hidden field name with caps and a hyphen"],
  ])("accepts %s as a storage key (%s)", (storageKey) => {
    // storageKey is deliberately not safe-identifier validated: migrated fields keep the
    // address their existing recall tokens and stored responses already use.
    expect(ZSurveyEmbeddedData.safeParse({ ...link, storageKey }).success).toBe(true);
  });

  test("rejects an empty storage key", () => {
    expect(ZSurveyEmbeddedData.safeParse({ ...link, storageKey: "" }).success).toBe(false);
  });
});
