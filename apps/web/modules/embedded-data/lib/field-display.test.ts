import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { ZEmbeddedDataType } from "@formbricks/types/embedded-data";
import { RESERVED_FIELD_CATALOG } from "@formbricks/types/embedded-data-resolver";
import {
  EMBEDDED_FIELD_ICON_BY_DATA_TYPE,
  RESERVED_FIELD_ICONS,
  getReservedFieldIcon,
  getReservedFieldLabel,
} from "./field-display";

/**
 * Returns the key rather than a translation, so an assertion names the key the label resolves
 * through. A label that is a key is localized; one that is words came out of the `default` arm.
 */
const t = ((key: string) => key) as unknown as TFunction;

describe("getReservedFieldLabel", () => {
  test("renders the acronyms the way they are written, not title-cased from the catalog name", () => {
    // The visible reason this helper reaches the pickers at all (ENG-1853): title-casing the catalog
    // name gave `Url`, `Os` and `Utm Campaign` in the editor next to a response table saying `URL`,
    // `OS` and `UTM Campaign` for the very same field.
    expect(getReservedFieldLabel("url", t)).toBe("common.url");
    expect(getReservedFieldLabel("os", t)).toBe("workspace.surveys.responses.os");
    expect(getReservedFieldLabel("ipAddress", t)).toBe("workspace.surveys.responses.ip_address");
  });

  test("splits camelCase names onto their own localized keys", () => {
    expect(getReservedFieldLabel("utmCampaign", t)).toBe("workspace.surveys.responses.utm_campaign");
    expect(getReservedFieldLabel("pagePath", t)).toBe("workspace.surveys.responses.page_path");
    expect(getReservedFieldLabel("pageReferrer", t)).toBe("workspace.surveys.responses.page_referrer");
  });

  test("labels the entries no column shows but a picker offers", () => {
    // `durationSeconds` (response filter) and `language` (mid-survey recall and logic) are both
    // `display: "none"`, so neither is covered by the response table's own keys.
    expect(getReservedFieldLabel("durationSeconds", t)).toBe("workspace.surveys.responses.duration_seconds");
    expect(getReservedFieldLabel("language", t)).toBe("common.language");
  });

  test("every catalog entry a mid-survey picker can offer has a localized key", () => {
    // The pickers filter on `availability !== "server"`, so this is exactly the set ENG-1853 renders.
    // A new client-available entry added without a key here would read in English in every locale —
    // the `default` arm is a last resort, and this test is what makes shipping one a deliberate act.
    const offerable = RESERVED_FIELD_CATALOG.filter((entry) => entry.availability !== "server");

    expect(offerable.length).toBeGreaterThan(0);
    for (const entry of offerable) {
      expect(getReservedFieldLabel(entry.name, t)).toContain(".");
    }
  });

  test("an unknown name still reads as a label rather than a raw catalog name", () => {
    // The `default` arm: a catalog entry added later surfaces everywhere with no edit here, in
    // English, until someone gives it a key.
    expect(getReservedFieldLabel("newlyAddedThing", t)).toBe("Newly Added Thing");
  });
});

describe("field icons", () => {
  test("there is an icon for every Embedded Data type", () => {
    // A row with no icon sits a text-width to the left of every other row, so an added dataType has
    // to be a compile error here — and this asserts the map is complete against the schema, not
    // against a list copied from it.
    expect(Object.keys(EMBEDDED_FIELD_ICON_BY_DATA_TYPE).sort()).toStrictEqual(
      [...ZEmbeddedDataType.options].sort()
    );
  });

  test("an auto-captured field with no icon of its own falls back to the generic one", () => {
    expect(getReservedFieldIcon("utmCampaign")).toBe(RESERVED_FIELD_ICONS.utmCampaign);
    expect(getReservedFieldIcon("responseId")).toBe(getReservedFieldIcon("surveyId"));
  });
});
