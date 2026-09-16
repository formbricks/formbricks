import { describe, expect, test } from "vitest";
import { labelEmbeddedFields } from "./embedded-data-label";
import type { TLinkedEmbeddedField } from "./embedded-data-resolver";

const ingested = (name: string, storageKey: string): TLinkedEmbeddedField => ({
  field: { name, key: null, source: "ingested", dataType: "string", defaultValue: null, locked: false },
  link: { storageKey },
});

describe("labelEmbeddedFields", () => {
  test("labels a field by its name, not the key its value is stored under", () => {
    expect(labelEmbeddedFields([ingested("Campaign", "utm_campaign")]).map(({ label }) => label)).toEqual([
      "Campaign",
    ]);
  });

  test("keeps the pair intact so the caller still reads values by storageKey", () => {
    expect(labelEmbeddedFields([ingested("Campaign", "utm_campaign")])[0]).toEqual({
      ...ingested("Campaign", "utm_campaign"),
      label: "Campaign",
    });
  });

  test("leaves distinct names bare — the key is noise when nothing collides", () => {
    const labels = labelEmbeddedFields([
      ingested("Campaign", "utm_campaign"),
      ingested("Source", "utm_source"),
    ]).map(({ label }) => label);

    expect(labels).toEqual(["Campaign", "Source"]);
  });

  test("disambiguates only the later claimant of a shared name", () => {
    const labels = labelEmbeddedFields([
      ingested("Source", "utm_source"),
      ingested("Source", "referrer"),
    ]).map(({ label }) => label);

    expect(labels).toEqual(["Source", "Source (referrer)"]);
  });

  test("disambiguates every later claimant, so three same-named fields stay tellable apart", () => {
    const labels = labelEmbeddedFields([
      ingested("Source", "a"),
      ingested("Source", "b"),
      ingested("Source", "c"),
    ]).map(({ label }) => label);

    expect(labels).toEqual(["Source", "Source (b)", "Source (c)"]);
    expect(new Set(labels).size).toBe(3);
  });

  test("a name spelled like an emitted disambiguation still gets its own label", () => {
    // Pathological, and the reason the set holds emitted labels rather than names seen: the export
    // addresses its rows by header, so two fields must never resolve to the same string.
    const labels = labelEmbeddedFields([
      ingested("Source", "a"),
      ingested("Source", "b"),
      ingested("Source (b)", "c"),
    ]).map(({ label }) => label);

    expect(labels).toEqual(["Source", "Source (b)", "Source (b) (c)"]);
    expect(new Set(labels).size).toBe(3);
  });

  test("returns nothing for a survey with no fields", () => {
    expect(labelEmbeddedFields([])).toEqual([]);
  });
});
