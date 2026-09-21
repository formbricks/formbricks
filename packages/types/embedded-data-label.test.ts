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

  test("stays collision-free when the literal name comes first, not second", () => {
    // The mirror of the case above, and the one the name-only check missed: `Source (b)` is emitted
    // bare because nothing claimed it yet, and the third field's *generated* label is then the same
    // string. Checking `field.name` alone never sees that — the collision is between two labels, not
    // between two names — so the export would ship two `Source (b)` headers and lose a value.
    const labels = labelEmbeddedFields([
      ingested("Source (b)", "c"),
      ingested("Source", "a"),
      ingested("Source", "b"),
    ]).map(({ label }) => label);

    expect(labels).toEqual(["Source (b)", "Source", "Source (b) (2)"]);
    expect(new Set(labels).size).toBe(3);
  });

  test("treats a seeded string as already claimed, so only the field that shadows one carries its key", () => {
    // The `reserved` seed is what lets a caller whose surface has other columns in the same
    // namespace — the response export, whose rows are flat objects keyed by header — keep this
    // rule covering the whole row rather than only this group.
    const labels = labelEmbeddedFields(
      [ingested("Response ID", "resp_id"), ingested("Campaign", "utm_campaign")],
      new Set(["Response ID", "Timestamp"])
    ).map(({ label }) => label);

    expect(labels).toEqual(["Response ID (resp_id)", "Campaign"]);
  });

  test("returns nothing for a survey with no fields", () => {
    expect(labelEmbeddedFields([])).toEqual([]);
  });
});
