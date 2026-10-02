import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { ZEmbeddedDataType } from "@formbricks/types/embedded-data";
import { DATA_TYPE_ICONS, type TDataTypeName, getDataTypeLabel } from "./data-types";

/**
 * Returns the key rather than a translation, so an assertion names the key the label resolves
 * through — the same convention as `modules/embedded-data/lib/field-display.test.ts`.
 */
const t = ((key: string) => key) as unknown as TFunction;

describe("getDataTypeLabel", () => {
  test("names every kind through a translation key", () => {
    expect(getDataTypeLabel("string", t)).toBe("common.text");
    expect(getDataTypeLabel("number", t)).toBe("common.number");
    expect(getDataTypeLabel("boolean", t)).toBe("workspace.embedded_data.type_boolean");
    expect(getDataTypeLabel("date", t)).toBe("common.date");
  });

  test("an unknown kind reads as text rather than as nothing", () => {
    // The `default` arm. `TContactAttributeDataType` is the narrower of the two unions this serves,
    // and a kind added to one domain before the other lands here rather than rendering blank.
    expect(getDataTypeLabel("unmapped" as TDataTypeName, t)).toBe("common.text");
  });
});

describe("DATA_TYPE_ICONS", () => {
  test("covers every Embedded Data type", () => {
    // Asserted against the schema rather than a list copied from it: a row with no icon sits a
    // text-width to the left of every other row, so an added type has to fail here.
    expect(Object.keys(DATA_TYPE_ICONS).sort()).toStrictEqual([...ZEmbeddedDataType.options].sort());
  });

  test("covers every contact attribute type", () => {
    // The other consumer. Attributes has no boolean, so this is a subset check rather than equality.
    for (const dataType of ZContactAttributeDataType.options) {
      expect(DATA_TYPE_ICONS[dataType]).toBeDefined();
    }
  });

  test("draws each kind differently", () => {
    // The point of the shared map is that a `number` never looks like a `date`. Two kinds sharing a
    // glyph would make the icon-only rendering (`showLabel={false}`) ambiguous.
    const glyphs = Object.values(DATA_TYPE_ICONS);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});
