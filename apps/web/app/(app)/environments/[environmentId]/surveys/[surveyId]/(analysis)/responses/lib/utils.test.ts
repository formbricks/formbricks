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
  getNestedKeys,
  getNestedValue,
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

  describe("getNestedKeys", () => {
    test("returns keys for flat object", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = getNestedKeys(obj);
      expect(result).toEqual(["a", "b", "c"]);
    });

    test("returns nested keys for nested object", () => {
      const obj = {
        user: {
          name: "John",
          age: 30,
          address: {
            street: "123 Main St",
            city: "Anytown",
          },
        },
        status: "active",
      };
      const result = getNestedKeys(obj);
      expect(result).toEqual(["user.name", "user.age", "user.address.street", "user.address.city", "status"]);
    });

    test("handles arrays as leaf values", () => {
      const obj = {
        tags: ["tag1", "tag2"],
        user: {
          hobbies: ["reading", "gaming"],
        },
      };
      const result = getNestedKeys(obj);
      expect(result).toEqual(["tags", "user.hobbies"]);
    });

    test("handles null values", () => {
      const obj = {
        user: {
          name: "John",
          email: null,
        },
        data: null,
      };
      const result = getNestedKeys(obj);
      expect(result).toEqual(["user.name", "user.email", "data"]);
    });

    test("handles empty object", () => {
      const obj = {};
      const result = getNestedKeys(obj);
      expect(result).toEqual([]);
    });

    test("uses custom prefix", () => {
      const obj = { name: "John", age: 30 };
      const result = getNestedKeys(obj, "user");
      expect(result).toEqual(["user.name", "user.age"]);
    });
  });

  describe("getNestedValue", () => {
    const testObj = {
      user: {
        name: "John",
        profile: {
          age: 30,
          location: {
            city: "New York",
            country: "USA",
          },
        },
      },
      status: "active",
      tags: ["admin", "user"],
    };

    test("returns value for simple field", () => {
      const result = getNestedValue(testObj, "status");
      expect(result).toBe("active");
    });

    test("returns value for nested field", () => {
      const result = getNestedValue(testObj, "user.name");
      expect(result).toBe("John");
    });

    test("returns value for deeply nested field", () => {
      const result = getNestedValue(testObj, "user.profile.age");
      expect(result).toBe(30);
    });

    test("returns value for very deeply nested field", () => {
      const result = getNestedValue(testObj, "user.profile.location.city");
      expect(result).toBe("New York");
    });

    test("returns array value", () => {
      const result = getNestedValue(testObj, "tags");
      expect(result).toEqual(["admin", "user"]);
    });

    test("returns undefined for non-existent keys", () => {
      const result = getNestedValue(testObj, "nonexistent");
      expect(result).toBeUndefined();
    });

    test("returns undefined for non-existent nested keys", () => {
      const result = getNestedValue(testObj, "user.nonexistent");
      expect(result).toBeUndefined();
    });

    test("handles single level field correctly", () => {
      const simpleObj = { name: "test" };
      const result = getNestedValue(simpleObj, "name");
      expect(result).toBe("test");
    });
  });
});
