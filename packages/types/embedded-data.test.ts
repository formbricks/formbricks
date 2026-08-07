import { describe, expect, test } from "vitest";
import { ZEmbeddedData, ZSurveyEmbeddedData, isLocalEmbeddedData } from "./embedded-data";
import { RESERVED_DECLARED_FIELD_NAMES } from "./surveys/validation";

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
  surveyId: "clx000000000000000000002",
  workspaceId: "clx000000000000000000003",
};

const sharedField = {
  ...localField,
  key: "weighted_score",
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

  describe("local / shared derivation", () => {
    test("rejects a field that is both owned by a survey and in the library", () => {
      expect(failedPaths({ ...localField, key: "score" })).toContain("key");
    });

    test("rejects a field that is neither owned by a survey nor in the library", () => {
      expect(failedPaths({ ...localField, key: null, surveyId: null })).toContain("key");
    });

    test("isLocalEmbeddedData derives from surveyId", () => {
      expect(isLocalEmbeddedData(localField)).toBe(true);
      expect(isLocalEmbeddedData(sharedField)).toBe(false);
    });
  });

  describe("name", () => {
    test.each([
      ["", "empty"],
      ["   ", "whitespace only"],
      ["\t", "a single tab"],
    ])("rejects a %s name", (name) => {
      // `name` is the label the library and the editor render, so blank means an unreadable row.
      expect(failedPaths({ ...localField, name })).toContain("name");
    });

    test("accepts a name with surrounding whitespace without trimming it", () => {
      const result = ZEmbeddedData.safeParse({ ...localField, name: " Score " });
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe(" Score ");
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

    test("rejects every reserved name, in any casing", () => {
      // A shared ingested field keyed `verify` or `lang` could never be filled, because ingestion
      // refuses to capture a reserved param. Blocked here so it can't be created in the first place.
      for (const reserved of RESERVED_DECLARED_FIELD_NAMES) {
        for (const candidate of [reserved, reserved.toUpperCase()]) {
          expect(failedPaths({ ...sharedField, key: candidate })).toContain("key");
        }
      }
    });

    test("accepts a name that merely contains a reserved word", () => {
      expect(ZEmbeddedData.safeParse({ ...sharedField, key: "language_pref" }).success).toBe(true);
    });
  });

  describe("source guards", () => {
    test("rejects a reserved field as a stored row", () => {
      // Reserved fields are a code catalog (ENG-1839), never rows — in either shape.
      const asLocal = {
        ...localField,
        source: "reserved" as const,
        dataType: "string" as const,
        defaultValue: null,
      };
      const asShared = {
        ...sharedField,
        source: "reserved" as const,
        dataType: "string" as const,
        defaultValue: null,
      };
      expect(failedPaths(asLocal)).toContain("source");
      expect(failedPaths(asShared)).toContain("source");
    });

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

    test.each(["boolean", "date"] as const)("rejects a computed field typed as %s", (dataType) => {
      // The logic engine only calculates strings and numbers.
      expect(failedPaths({ ...localField, dataType, defaultValue: null })).toContain("dataType");
    });

    test.each(["string", "number"] as const)("accepts a computed field typed as %s", (dataType) => {
      const value = dataType === "number" ? 0 : "";
      expect(ZEmbeddedData.safeParse({ ...localField, dataType, defaultValue: value }).success).toBe(true);
    });
  });

  describe("defaultValue must match dataType", () => {
    /** Ingested so every dataType is allowed; the computed restriction is covered above. */
    const ingested = { ...localField, source: "ingested" as const };

    test.each([
      ["number", "abc"],
      ["boolean", 0],
      ["string", true],
      ["date", "banana"],
      ["date", 20260806],
    ] as const)("rejects dataType %s with default %p", (dataType, defaultValue) => {
      expect(failedPaths({ ...ingested, dataType, defaultValue })).toContain("defaultValue");
    });

    test.each([
      ["number", 42],
      ["boolean", true],
      ["string", "web"],
      ["date", "2026-08-06"],
      ["date", "2026-08-06T10:30:00Z"],
    ] as const)("accepts dataType %s with default %p", (dataType, defaultValue) => {
      expect(ZEmbeddedData.safeParse({ ...ingested, dataType, defaultValue }).success).toBe(true);
    });

    test("accepts a null default for every dataType", () => {
      for (const dataType of ["string", "number", "boolean", "date"] as const) {
        expect(ZEmbeddedData.safeParse({ ...ingested, dataType, defaultValue: null }).success).toBe(true);
      }
    });
  });
});

describe("ZSurveyEmbeddedData", () => {
  const link = {
    id: "clx000000000000000000004",
    workspaceId: "clx000000000000000000003",
    surveyId: "clx000000000000000000002",
    embeddedDataId: "clx000000000000000000001",
    storageKey: "plan",
  };

  test("accepts a link", () => {
    expect(ZSurveyEmbeddedData.safeParse(link).success).toBe(true);
  });

  test("requires a workspaceId, since it is part of both foreign keys", () => {
    const { workspaceId: _omitted, ...withoutWorkspace } = link;
    expect(ZSurveyEmbeddedData.safeParse(withoutWorkspace).success).toBe(false);
  });

  test.each([
    ["clx000000000000000000005", "a computed field's cuid"],
    ["Brand-Name", "a legacy hidden field name with caps and a hyphen"],
    ["verify", "a reserved name a stored survey may already hold"],
    ["x".repeat(300), "a name longer than any create-time cap"],
  ])("accepts %s as a storage key (%s)", (storageKey) => {
    // Migrated fields keep the address their existing recall tokens and stored responses use, so
    // anything the ENG-1835 backfill can move has to parse here.
    expect(ZSurveyEmbeddedData.safeParse({ ...link, storageKey }).success).toBe(true);
  });

  test.each([
    ["", "empty"],
    ["   ", "whitespace only"],
    [" plan ", "padded — would never match ?plan= and counts as distinct from plan"],
    ["page type", "contains a space"],
    ["a;DROP TABLE", "outside the legacy charset"],
    ["../../etc/passwd", "outside the legacy charset"],
  ])("rejects %s as a storage key (%s)", (storageKey) => {
    // The ceiling is `isLegacyIdCharset`, which the survey load path already enforces on hidden
    // field ids — so no survey that still loads can hold a name this rejects.
    expect(ZSurveyEmbeddedData.safeParse({ ...link, storageKey }).success).toBe(false);
  });
});
