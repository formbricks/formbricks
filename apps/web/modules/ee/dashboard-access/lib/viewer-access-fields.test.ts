import { describe, expect, test } from "vitest";
import { findRepeatedViewerConditions } from "./viewer-access-fields";

describe("findRepeatedViewerConditions", () => {
  test("flags a later condition with the same field and attribute, not the first", () => {
    expect(
      findRepeatedViewerConditions([
        { field: "FeedbackRecords.sourceName", attributeKeyId: null },
        { field: "FeedbackRecords.metadataCountry", attributeKeyId: "key_country" },
        { field: "FeedbackRecords.sourceName", attributeKeyId: null },
      ])
    ).toEqual([2]);
  });

  test("the same field against another attribute, or another field, is not a repeat", () => {
    expect(
      findRepeatedViewerConditions([
        { field: "FeedbackRecords.metadataCountry", attributeKeyId: "key_country" },
        { field: "FeedbackRecords.metadataCountry", attributeKeyId: null },
        { field: "FeedbackRecords.language", attributeKeyId: "key_country" },
      ])
    ).toEqual([]);
  });

  test("an embedded key repeats regardless of surrounding spaces, but not of case", () => {
    expect(
      findRepeatedViewerConditions([
        { field: "ed:region", attributeKeyId: "key_region" },
        { field: "ed: region ", attributeKeyId: "key_region" },
        { field: "ed:Region", attributeKeyId: "key_region" },
      ])
    ).toEqual([1]);
  });
});
