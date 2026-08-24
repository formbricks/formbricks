import "@testing-library/jest-dom/vitest";
import { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import { RESERVED_FIELD_CATALOG } from "@formbricks/types/embedded-data-resolver";
import { TResponse } from "@formbricks/types/responses";
import {
  RESERVED_COLUMN_ENTRIES,
  getAddressFieldLabel,
  getContactInfoFieldLabel,
  getReservedColumnLabel,
  getReservedColumnValues,
  isReservedColumnVisibleByDefault,
  reservedColumnId,
} from "./utils";

describe("utils", () => {
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      "workspace.surveys.responses.address_line_1": "Address Line 1",
      "workspace.surveys.responses.address_line_2": "Address Line 2",
      "workspace.surveys.responses.city": "City",
      "workspace.surveys.responses.state_region": "State/Region",
      "workspace.surveys.responses.zip_post_code": "ZIP/Post Code",
      "workspace.surveys.responses.country": "Country",
      "workspace.surveys.responses.first_name": "First Name",
      "workspace.surveys.responses.last_name": "Last Name",
      "workspace.surveys.responses.email": "Email",
      "workspace.surveys.responses.phone": "Phone",
      "workspace.surveys.responses.company": "Company",
      "common.action": "Action",
      "workspace.surveys.responses.os": "OS",
      "workspace.surveys.responses.device": "Device",
      "workspace.surveys.responses.browser": "Browser",
      "common.url": "URL",
      "workspace.surveys.responses.source": "Source",
      "workspace.surveys.responses.ip_address": "IP Address",
      "workspace.surveys.responses.page_path": "Page Path",
      "workspace.surveys.responses.page_referrer": "Page Referrer",
      "workspace.surveys.responses.screen_height": "Screen Height",
      "workspace.surveys.responses.screen_width": "Screen Width",
      "workspace.surveys.responses.timezone": "Timezone",
      "workspace.surveys.responses.utm_campaign": "UTM Campaign",
      "workspace.surveys.responses.utm_content": "UTM Content",
      "workspace.surveys.responses.utm_medium": "UTM Medium",
      "workspace.surveys.responses.utm_source": "UTM Source",
      "workspace.surveys.responses.utm_term": "UTM Term",
      "workspace.surveys.responses.viewport_height": "Viewport Height",
      "workspace.surveys.responses.viewport_width": "Viewport Width",
    };
    return translations[key] || key;
  }) as unknown as TFunction;

  describe("getAddressFieldLabel", () => {
    test("returns correct label for addressLine1", () => {
      const result = getAddressFieldLabel("addressLine1", mockT);
      expect(result).toBe("Address Line 1");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.address_line_1");
    });

    test("returns correct label for addressLine2", () => {
      const result = getAddressFieldLabel("addressLine2", mockT);
      expect(result).toBe("Address Line 2");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.address_line_2");
    });

    test("returns correct label for city", () => {
      const result = getAddressFieldLabel("city", mockT);
      expect(result).toBe("City");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.city");
    });

    test("returns correct label for state", () => {
      const result = getAddressFieldLabel("state", mockT);
      expect(result).toBe("State/Region");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.state_region");
    });

    test("returns correct label for zip", () => {
      const result = getAddressFieldLabel("zip", mockT);
      expect(result).toBe("ZIP/Post Code");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.zip_post_code");
    });

    test("returns correct label for country", () => {
      const result = getAddressFieldLabel("country", mockT);
      expect(result).toBe("Country");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.country");
    });

    test("returns undefined for unknown field", () => {
      const result = getAddressFieldLabel("unknown", mockT);
      expect(result).toBeUndefined();
      expect(mockT).not.toHaveBeenCalled();
    });
  });

  describe("getContactInfoFieldLabel", () => {
    test("returns correct label for firstName", () => {
      const result = getContactInfoFieldLabel("firstName", mockT);
      expect(result).toBe("First Name");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.first_name");
    });

    test("returns correct label for lastName", () => {
      const result = getContactInfoFieldLabel("lastName", mockT);
      expect(result).toBe("Last Name");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.last_name");
    });

    test("returns correct label for email", () => {
      const result = getContactInfoFieldLabel("email", mockT);
      expect(result).toBe("Email");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.email");
    });

    test("returns correct label for phone", () => {
      const result = getContactInfoFieldLabel("phone", mockT);
      expect(result).toBe("Phone");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.phone");
    });

    test("returns correct label for company", () => {
      const result = getContactInfoFieldLabel("company", mockT);
      expect(result).toBe("Company");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.company");
    });

    test("returns undefined for unknown field", () => {
      const result = getContactInfoFieldLabel("unknown", mockT);
      expect(result).toBeUndefined();
      expect(mockT).not.toHaveBeenCalled();
    });
  });

  describe("getReservedColumnLabel", () => {
    test("uses the product's own wording where it exists", () => {
      // The override layer. These seven have shipped labels an author recognises, and deriving them
      // from the name would visibly regress copy: `Url` for `URL`, `Ip Address` for `IP Address`.
      expect(getReservedColumnLabel("action", mockT)).toBe("Action");
      expect(mockT).toHaveBeenCalledWith("common.action");
      expect(getReservedColumnLabel("url", mockT)).toBe("URL");
      expect(mockT).toHaveBeenCalledWith("common.url");
      expect(getReservedColumnLabel("ipAddress", mockT)).toBe("IP Address");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.ip_address");
    });

    test("the catalog's `deviceType` keeps the column's existing `Device` header", () => {
      // The one spelling divergence between the catalog and both display surfaces. Without the
      // override, this column's header would change from `Device` to `Device Type` for every survey.
      expect(getReservedColumnLabel("deviceType", mockT)).toBe("Device");
      expect(mockT).toHaveBeenCalledWith("workspace.surveys.responses.device");
    });

    test("routes every field either surface displays through `t()`, so none ships as English", () => {
      // The i18n rule, pinned. ENG-1841's twelve names used to fall through to
      // `formatFieldNameToTitleCase`, which reads as English in all fifteen locales — and gave
      // `Utm Source` for `UTM Source` on the way. Asserting the key, not just the label, is what
      // makes this red if one of them goes back to being derived.
      const expected: [name: string, key: string, label: string][] = [
        ["pagePath", "page_path", "Page Path"],
        ["pageReferrer", "page_referrer", "Page Referrer"],
        ["screenHeight", "screen_height", "Screen Height"],
        ["screenWidth", "screen_width", "Screen Width"],
        ["timezone", "timezone", "Timezone"],
        ["utmCampaign", "utm_campaign", "UTM Campaign"],
        ["utmContent", "utm_content", "UTM Content"],
        ["utmMedium", "utm_medium", "UTM Medium"],
        ["utmSource", "utm_source", "UTM Source"],
        ["utmTerm", "utm_term", "UTM Term"],
        ["viewportHeight", "viewport_height", "Viewport Height"],
        ["viewportWidth", "viewport_width", "Viewport Width"],
      ];

      for (const [name, key, label] of expected) {
        expect(getReservedColumnLabel(name, mockT), name).toBe(label);
        expect(mockT, name).toHaveBeenCalledWith(`workspace.surveys.responses.${key}`);
      }
    });

    test("still derives a label for a catalog entry nobody has written a key for yet", () => {
      // The fallback stays a real fallback rather than dead code, which is what keeps a catalog
      // addition free: ENG-1858's next batch reaches both surfaces with no edit to the switch,
      // reading in English until someone adds its key.
      expect(getReservedColumnLabel("connectionType", mockT)).toBe("Connection Type");
      expect(mockT).not.toHaveBeenCalled();
    });
  });

  describe("RESERVED_COLUMN_ENTRIES", () => {
    test("offers a column for every catalog entry a human reads as data", () => {
      expect(RESERVED_COLUMN_ENTRIES.map((entry) => entry.name)).toStrictEqual(
        RESERVED_FIELD_CATALOG.filter((entry) => entry.display !== "none").map((entry) => entry.name)
      );
    });

    test("excludes the response's own identity and timing, which fixed columns already show", () => {
      const names = RESERVED_COLUMN_ENTRIES.map((entry) => entry.name);

      for (const excluded of ["responseId", "createdAt", "startedAt", "finishedAt", "finished", "language"]) {
        expect(names, excluded).not.toContain(excluded);
      }
    });

    test("the Device column keeps its persisted id, not the catalog's spelling", () => {
      // The id is a storage key: `${survey.id}-columnOrder` and `-columnVisibility` in localStorage
      // hold it. The catalog calls this field `deviceType` and the column has always been
      // `METADATA_device`; following the catalog would discard an author's saved choice for it, and
      // because a `primary` column is left unseeded (absent = visible), an author who had HIDDEN
      // Device would have found it back on after upgrading.
      expect(reservedColumnId("deviceType")).toBe("METADATA_device");
    });

    test("every other reserved column takes its catalog name as its id", () => {
      // The exception map must stay an exception: a future catalog entry needs no edit there.
      for (const name of ["url", "country", "pagePath", "utmSource", "timezone", "ipAddress"]) {
        expect(reservedColumnId(name), name).toBe(`METADATA_${name}`);
      }
    });

    test("a catalog entry added later becomes a column with no change here", () => {
      // The guard the ticket asks for. Driven off the catalog rather than a literal list, so this
      // assertion is what would fail if someone reintroduced a local `METADATA_FIELDS`.
      expect(RESERVED_COLUMN_ENTRIES.map((entry) => entry.name)).toContain("utmCampaign");
      expect(RESERVED_COLUMN_ENTRIES.map((entry) => entry.name)).toContain("timezone");
      expect(RESERVED_COLUMN_ENTRIES).toHaveLength(20);
    });

    test("today's six columns are still visible by default, and the new ones are not", () => {
      const visible = RESERVED_COLUMN_ENTRIES.filter((entry) =>
        isReservedColumnVisibleByDefault(entry.display)
      ).map((entry) => entry.name);

      expect(visible).toStrictEqual(["source", "url", "country", "action", "browser", "os", "deviceType"]);
      expect(isReservedColumnVisibleByDefault("secondary")).toBe(false);
    });
  });

  describe("getReservedColumnValues", () => {
    const response = {
      id: "clx0000000000000000000r1",
      surveyId: "clx0000000000000000000s1",
      createdAt: new Date("2026-08-01T09:00:00.000Z"),
      updatedAt: new Date("2026-08-01T09:01:00.000Z"),
      finished: true,
      language: "de",
      data: {},
      variables: {},
      ttc: {},
      meta: {
        source: "link",
        url: "https://example.com/pricing?email=a@b.co",
        userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
        country: "DE",
        pagePath: "/pricing",
        utmSource: "news",
        viewportWidth: 1280,
      },
    } as unknown as TResponse;

    test("keys values by column id, resolving where the field actually lives", () => {
      const values = getReservedColumnValues(response);

      // `deviceType` is stored at `meta.userAgent.device`, which is exactly what the old per-column
      // switch existed to know. The catalog's accessor knows it instead.
      expect(values[reservedColumnId("deviceType")]).toBe("desktop");
      expect(values[reservedColumnId("browser")]).toBe("Chrome");
      expect(values[reservedColumnId("pagePath")]).toBe("/pricing");
      expect(values[reservedColumnId("utmSource")]).toBe("news");
    });

    test("numbers arrive as strings a cell can render directly", () => {
      expect(getReservedColumnValues(response)[reservedColumnId("viewportWidth")]).toBe("1280");
    });

    test("inherits the projection's redaction rather than reading meta again", () => {
      // `url` is `privacy: "redactQuery"`. Reading `meta.url` directly — which the old switch did —
      // would put the respondent's `?email=` into a visible column and every clipboard copy.
      expect(getReservedColumnValues(response)[reservedColumnId("url")]).toBe("https://example.com/pricing");
    });

    test("omits what the response does not carry, so a cell stays empty", () => {
      const values = getReservedColumnValues(response);

      expect(values).not.toHaveProperty(reservedColumnId("timezone"));
      expect(values).not.toHaveProperty(reservedColumnId("ipAddress"));
    });
  });
});
