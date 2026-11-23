import { describe, expect, test } from "vitest";
import {
  VIEWER_ACCESS_MAX_VALUES,
  buildViewerAccessClaim,
  isViewerAccessField,
  normalizeViewerAccessValues,
  summarizeViewerAccess,
} from "./viewer-access-claim";

const condition = (field: string, values: string[], attributeLabel = "Region") => ({
  field,
  attributeKeyId: "clak000000000000000000001",
  attributeLabel,
  values,
});

describe("viewer access claim (ADR-0061)", () => {
  test("no conditions: no claim, unrestricted", () => {
    expect(buildViewerAccessClaim(null)).toBeNull();
    expect(buildViewerAccessClaim({ join: "all", conditions: [] })).toBeNull();
    expect(summarizeViewerAccess([null])).toEqual({ status: "unrestricted", chips: [] });
  });

  test("carries several values per condition, trimmed and once per case", () => {
    const built = buildViewerAccessClaim({
      join: "all",
      conditions: [condition("FeedbackRecords.metadataCountry", [" DE ", "de", "FR", ""])],
    });
    expect(built).toEqual({
      claim: {
        join: "all",
        conditions: [{ member: "FeedbackRecords.metadataCountry", values: ["DE", "FR"] }],
      },
      embeddedKeys: [],
    });
  });

  test("an embedded-data condition names its compiled member and its key", () => {
    const built = buildViewerAccessClaim({ join: "any", conditions: [condition("ed:region", ["EU"])] });
    expect(built?.embeddedKeys).toEqual(["region"]);
    expect(built?.claim.conditions[0].member).toMatch(/^FeedbackRecords\.ed_/);
  });

  test("values are bounded", () => {
    const many = Array.from({ length: VIEWER_ACCESS_MAX_VALUES + 5 }, (_, i) => `v${i}`);
    expect(normalizeViewerAccessValues(many)).toHaveLength(VIEWER_ACCESS_MAX_VALUES);
    expect(normalizeViewerAccessValues(["x".repeat(256)])).toEqual([]);
  });

  test("answers and measures are never a condition field", () => {
    expect(isViewerAccessField("FeedbackRecords.sourceName")).toBe(true);
    expect(isViewerAccessField("ed:region")).toBe(true);
    expect(isViewerAccessField("FeedbackRecords.valueText")).toBe(false);
    expect(isViewerAccessField("FeedbackRecords.count")).toBe(false);
    expect(isViewerAccessField("ed:")).toBe(false);
  });

  test("an any join is one chip, labels joined with or", () => {
    const summary = summarizeViewerAccess([
      {
        join: "any",
        conditions: [
          condition("FeedbackRecords.metadataCountry", ["DE"]),
          condition("FeedbackRecords.language", ["en"], "Language"),
        ],
      },
    ]);
    expect(summary).toEqual({
      status: "restricted",
      chips: [{ label: "Country or Language", attributeLabel: "Region or Language", values: ["DE", "en"] }],
    });
  });

  test("an empty attribute leaves nothing: unmatched with all, matched by another value with any", () => {
    const empty = condition("FeedbackRecords.metadataCountry", []);
    expect(summarizeViewerAccess([{ join: "all", conditions: [empty] }]).status).toBe("unmatched");
    expect(
      summarizeViewerAccess([
        { join: "any", conditions: [empty, condition("FeedbackRecords.language", ["de"])] },
      ]).status
    ).toBe("restricted");
  });
});
