import "@testing-library/jest-dom/vitest";
import {
  AirplayIcon,
  ArrowUpFromDotIcon,
  FlagIcon,
  GlobeIcon,
  MousePointerClickIcon,
  SmartphoneIcon,
} from "lucide-react";
import { describe, expect, test, vi } from "vitest";
import {
  COLUMNS_ICON_MAP,
  getAddressFieldLabel,
  getContactInfoFieldLabel,
  getMetadataFieldLabel,
  getMetadataValue,
} from "./utils";

describe("utils", () => {
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      "environments.surveys.responses.address_line_1": "Address Line 1",
      "environments.surveys.responses.address_line_2": "Address Line 2",
      "environments.surveys.responses.city": "City",
      "environments.surveys.responses.state_region": "State/Region",
      "environments.surveys.responses.zip_post_code": "ZIP/Post Code",
      "environments.surveys.responses.country": "Country",
      "environments.surveys.responses.first_name": "First Name",
      "environments.surveys.responses.last_name": "Last Name",
      "environments.surveys.responses.email": "Email",
      "environments.surveys.responses.phone": "Phone",
      "environments.surveys.responses.company": "Company",
      "common.action": "Action",
      "environments.surveys.responses.os": "OS",
      "environments.surveys.responses.device": "Device",
      "environments.surveys.responses.browser": "Browser",
      "common.url": "URL",
      "environments.surveys.responses.source": "Source",
    };
    return translations[key] || key;
  });

  describe("getAddressFieldLabel", () => {
    test("returns correct label for addressLine1", () => {
      const result = getAddressFieldLabel("addressLine1", mockT);
      expect(result).toBe("Address Line 1");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.address_line_1");
    });

    test("returns correct label for addressLine2", () => {
      const result = getAddressFieldLabel("addressLine2", mockT);
      expect(result).toBe("Address Line 2");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.address_line_2");
    });

    test("returns correct label for city", () => {
      const result = getAddressFieldLabel("city", mockT);
      expect(result).toBe("City");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.city");
    });

    test("returns correct label for state", () => {
      const result = getAddressFieldLabel("state", mockT);
      expect(result).toBe("State/Region");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.state_region");
    });

    test("returns correct label for zip", () => {
      const result = getAddressFieldLabel("zip", mockT);
      expect(result).toBe("ZIP/Post Code");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.zip_post_code");
    });

    test("returns correct label for country", () => {
      const result = getAddressFieldLabel("country", mockT);
      expect(result).toBe("Country");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.country");
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
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.first_name");
    });

    test("returns correct label for lastName", () => {
      const result = getContactInfoFieldLabel("lastName", mockT);
      expect(result).toBe("Last Name");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.last_name");
    });

    test("returns correct label for email", () => {
      const result = getContactInfoFieldLabel("email", mockT);
      expect(result).toBe("Email");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.email");
    });

    test("returns correct label for phone", () => {
      const result = getContactInfoFieldLabel("phone", mockT);
      expect(result).toBe("Phone");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.phone");
    });

    test("returns correct label for company", () => {
      const result = getContactInfoFieldLabel("company", mockT);
      expect(result).toBe("Company");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.company");
    });

    test("returns undefined for unknown field", () => {
      const result = getContactInfoFieldLabel("unknown", mockT);
      expect(result).toBeUndefined();
      expect(mockT).not.toHaveBeenCalled();
    });
  });

  describe("getMetadataFieldLabel", () => {
    test("returns correct label for action", () => {
      const result = getMetadataFieldLabel("action", mockT);
      expect(result).toBe("Action");
      expect(mockT).toHaveBeenCalledWith("common.action");
    });

    test("returns correct label for country", () => {
      const result = getMetadataFieldLabel("country", mockT);
      expect(result).toBe("Country");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.country");
    });

    test("returns correct label for os", () => {
      const result = getMetadataFieldLabel("os", mockT);
      expect(result).toBe("OS");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.os");
    });

    test("returns correct label for device", () => {
      const result = getMetadataFieldLabel("device", mockT);
      expect(result).toBe("Device");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.device");
    });

    test("returns correct label for browser", () => {
      const result = getMetadataFieldLabel("browser", mockT);
      expect(result).toBe("Browser");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.browser");
    });

    test("returns correct label for url", () => {
      const result = getMetadataFieldLabel("url", mockT);
      expect(result).toBe("URL");
      expect(mockT).toHaveBeenCalledWith("common.url");
    });

    test("returns correct label for source", () => {
      const result = getMetadataFieldLabel("source", mockT);
      expect(result).toBe("Source");
      expect(mockT).toHaveBeenCalledWith("environments.surveys.responses.source");
    });

    test("returns capitalized label for unknown field", () => {
      const result = getMetadataFieldLabel("customField", mockT);
      expect(result).toBe("Customfield");
      expect(mockT).not.toHaveBeenCalled();
    });

    test("returns capitalized label for field with underscores", () => {
      const result = getMetadataFieldLabel("custom_field", mockT);
      expect(result).toBe("Custom_field");
      expect(mockT).not.toHaveBeenCalled();
    });
  });

  describe("COLUMNS_ICON_MAP", () => {
    test("contains correct icon mappings", () => {
      expect(COLUMNS_ICON_MAP.action).toBe(MousePointerClickIcon);
      expect(COLUMNS_ICON_MAP.country).toBe(FlagIcon);
      expect(COLUMNS_ICON_MAP.browser).toBe(GlobeIcon);
      expect(COLUMNS_ICON_MAP.os).toBe(AirplayIcon);
      expect(COLUMNS_ICON_MAP.device).toBe(SmartphoneIcon);
      expect(COLUMNS_ICON_MAP.source).toBe(ArrowUpFromDotIcon);
      expect(COLUMNS_ICON_MAP.url).toBe(GlobeIcon);
    });
  });

  describe("getMetadataValue", () => {
    test("returns correct value for action", () => {
      const result = getMetadataValue({ action: "action_column" }, "action");
      expect(result).toBe("action_column");
    });

    test("returns correct value for userAgent", () => {
      const result = getMetadataValue({ userAgent: { browser: "browser_column" } }, "browser");
      expect(result).toBe("browser_column");
    });
  });
});
