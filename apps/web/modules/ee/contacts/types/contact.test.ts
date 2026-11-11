import { describe, expect, test, vi } from "vitest";
import { ZodError } from "zod";
import {
  CSV_IMPORT_MAX_COLUMNS,
  CSV_IMPORT_MAX_KEY_LENGTH,
  CSV_IMPORT_MAX_RECORDS,
  CSV_IMPORT_MAX_VALUE_LENGTH,
} from "../lib/csv-import-limits";
import {
  ZContact,
  ZContactBulkUploadRequest,
  ZContactCSVAttributeMap,
  ZContactCSVUploadResponse,
  ZContactCreateRequest,
  ZContactResponse,
  ZContactTableData,
  ZContactWithAttributes,
  validateEmailAttribute,
  validateUniqueAttributeKeys,
} from "./contact";

describe("ZContact", () => {
  test("should validate valid contact data", () => {
    const validContact = {
      id: "cld1234567890abcdef123456",
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "cld1234567890abcdef123456",
    };
    const result = ZContact.parse(validContact);
    expect(result).toEqual(validContact);
  });

  test("should reject invalid contact data", () => {
    const invalidContact = {
      id: "invalid-id",
      createdAt: "invalid-date",
      updatedAt: new Date(),
      workspaceId: "cld1234567890abcdef123456",
    };
    expect(() => ZContact.parse(invalidContact)).toThrow(ZodError);
  });
});

describe("ZContactTableData", () => {
  test("should validate valid contact table data", () => {
    const validData = {
      id: "cld1234567890abcdef123456",
      userId: "user123",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      attributes: [
        {
          key: "attr1",
          name: "Attribute 1",
          value: "value1",
          dataType: "string",
        },
      ],
    };
    const result = ZContactTableData.parse(validData);
    expect(result).toEqual(validData);
  });

  test("should handle nullable names and values in attributes", () => {
    const validData = {
      id: "cld1234567890abcdef123456",
      userId: "user123",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      attributes: [
        {
          key: "attr1",
          name: null,
          value: null,
          dataType: "string",
        },
      ],
    };
    const result = ZContactTableData.parse(validData);
    expect(result).toEqual(validData);
  });
});

describe("ZContactWithAttributes", () => {
  test("should validate contact with attributes", () => {
    const validData = {
      id: "cld1234567890abcdef123456",
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
        firstName: "John",
      },
    };
    const result = ZContactWithAttributes.parse(validData);
    expect(result).toEqual(validData);
  });
});

describe("ZContactCSVUploadResponse", () => {
  test("should validate valid CSV upload data", () => {
    const validData = [
      {
        email: "test1@example.com",
        firstName: "John",
        lastName: "Doe",
      },
      {
        email: "test2@example.com",
        firstName: "Jane",
        lastName: "Smith",
      },
    ];
    const result = ZContactCSVUploadResponse.parse(validData);
    expect(result).toEqual(validData);
  });

  test("should reject data without email field", () => {
    const invalidData = [
      {
        firstName: "John",
        lastName: "Doe",
      },
    ];
    expect(() => ZContactCSVUploadResponse.parse(invalidData)).toThrow(ZodError);
  });

  test("should reject data with empty email", () => {
    const invalidData = [
      {
        email: "",
        firstName: "John",
        lastName: "Doe",
      },
    ];
    expect(() => ZContactCSVUploadResponse.parse(invalidData)).toThrow(ZodError);
  });

  test("should reject data with duplicate emails", () => {
    const invalidData = [
      {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      },
      {
        email: "test@example.com",
        firstName: "Jane",
        lastName: "Smith",
      },
    ];
    expect(() => ZContactCSVUploadResponse.parse(invalidData)).toThrow(ZodError);
  });

  test("should reject data with duplicate userIds", () => {
    const invalidData = [
      {
        email: "test1@example.com",
        userId: "user123",
        firstName: "John",
        lastName: "Doe",
      },
      {
        email: "test2@example.com",
        userId: "user123",
        firstName: "Jane",
        lastName: "Smith",
      },
    ];
    expect(() => ZContactCSVUploadResponse.parse(invalidData)).toThrow(ZodError);
  });

  test("should reject data exceeding 10000 records", () => {
    const invalidData = Array.from({ length: 10001 }, (_, i) => ({
      email: `test${i}@example.com`,
      firstName: "John",
      lastName: "Doe",
    }));
    expect(() => ZContactCSVUploadResponse.parse(invalidData)).toThrow(ZodError);
  });
});

describe("ZContactCSVAttributeMap", () => {
  test("should validate valid attribute map", () => {
    const validMap = {
      firstName: "first_name",
      lastName: "last_name",
      email: "email_address",
    };
    const result = ZContactCSVAttributeMap.parse(validMap);
    expect(result).toEqual(validMap);
  });

  test("should reject attribute map with duplicate values", () => {
    const invalidMap = {
      firstName: "name",
      lastName: "name",
      email: "email",
    };
    expect(() => ZContactCSVAttributeMap.parse(invalidMap)).toThrow(ZodError);
  });
});

describe("the CSV import's caps", () => {
  const issues = (result: { success: boolean; error?: ZodError }) =>
    result.error?.issues.map(({ message, path }) => ({ message, path })) ?? [];
  const record = (extra: Record<string, string> = {}) => ({ email: "ada@example.com", ...extra });
  /** A record of `count` columns, the email among them. */
  const columns = (count: number) =>
    record(Object.fromEntries(Array.from({ length: count - 1 }, (_, i) => [`column_${i}`, "x"])));

  test(`takes ${CSV_IMPORT_MAX_RECORDS} records and refuses one more with the existing message`, () => {
    const records = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ email: `user${i}@example.com` }));

    expect(ZContactCSVUploadResponse.safeParse(records(CSV_IMPORT_MAX_RECORDS)).success).toBe(true);
    expect(issues(ZContactCSVUploadResponse.safeParse(records(CSV_IMPORT_MAX_RECORDS + 1)))).toEqual([
      { message: "Maximum 10000 records allowed at a time.", path: [] },
    ]);
  });

  test.each([
    [
      "columns",
      columns(CSV_IMPORT_MAX_COLUMNS),
      columns(CSV_IMPORT_MAX_COLUMNS + 1),
      "A record may have at most 160 entries (record 1)",
    ],
    [
      "a column name's length",
      record({ ["k".repeat(CSV_IMPORT_MAX_KEY_LENGTH)]: "x" }),
      record({ ["k".repeat(CSV_IMPORT_MAX_KEY_LENGTH + 1)]: "x" }),
      "A column name must be at most 255 characters (record 1)",
    ],
    [
      "a value's length",
      record({ note: "v".repeat(CSV_IMPORT_MAX_VALUE_LENGTH) }),
      record({ note: "v".repeat(CSV_IMPORT_MAX_VALUE_LENGTH + 1) }),
      "A value must be at most 10000 characters (record 1)",
    ],
    [
      "NUL in a value",
      record({ note: "a" }),
      record({ note: "a\u0000" }),
      "A value must not contain NUL characters (record 1)",
    ],
    [
      "NUL in a column name",
      record({ note: "a" }),
      record({ "no\u0000te": "a" }),
      "A column name must not contain NUL characters (record 1)",
    ],
  ])("refuses %s just past the cap, naming it, with one issue", (_label, atLimit, pastLimit, message) => {
    expect(ZContactCSVUploadResponse.safeParse([atLimit]).success).toBe(true);
    expect(issues(ZContactCSVUploadResponse.safeParse([record(), pastLimit]))).toEqual([
      { message: message.replace("record 1", "record 2"), path: [1] },
    ]);
  });

  test("reports one issue however many cells break a cap, before the typed schema runs", () => {
    const bad = Array.from({ length: 50 }, (_, i) => ({
      email: `u${i}@example.com`,
      note: 1 as unknown as string,
    }));

    expect(issues(ZContactCSVUploadResponse.safeParse(bad))).toEqual([
      { message: "A value must be text (record 1)", path: [0] },
    ]);
  });

  test.each([
    [
      "entries",
      columns(CSV_IMPORT_MAX_COLUMNS),
      columns(CSV_IMPORT_MAX_COLUMNS + 1),
      "The attribute map may have at most 160 entries",
    ],
    [
      "a column name's length",
      { ["k".repeat(CSV_IMPORT_MAX_KEY_LENGTH)]: "a" },
      { ["k".repeat(CSV_IMPORT_MAX_KEY_LENGTH + 1)]: "a" },
      "A column name must be at most 255 characters",
    ],
    [
      "a mapped attribute's length",
      { name: "a".repeat(CSV_IMPORT_MAX_KEY_LENGTH) },
      { name: "a".repeat(CSV_IMPORT_MAX_KEY_LENGTH + 1) },
      "A mapped attribute must be at most 255 characters",
    ],
    ["NUL", { name: "a" }, { name: "a\u0000" }, "A mapped attribute must not contain NUL characters"],
  ])("refuses an attribute map past its %s cap", (_label, atLimit, pastLimit, message) => {
    // `columns()` repeats "x" as every value; the map refuses duplicate values on its own.
    const distinct = (map: Record<string, string>) =>
      Object.fromEntries(Object.keys(map).map((key, i) => [key, map[key] === "x" ? `attr_${i}` : map[key]]));

    expect(ZContactCSVAttributeMap.safeParse(distinct(atLimit)).success).toBe(true);
    expect(issues(ZContactCSVAttributeMap.safeParse(distinct(pastLimit)))).toEqual([{ message, path: [] }]);
  });
});

describe("ZContactBulkUploadRequest", () => {
  test("should validate valid bulk upload request", () => {
    const validRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: [
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "test@example.com",
            },
          ],
        },
      ],
    };
    const result = ZContactBulkUploadRequest.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  test("should reject request without email attribute", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: [
        {
          attributes: [
            {
              attributeKey: {
                key: "firstName",
                name: "First Name",
              },
              value: "John",
            },
          ],
        },
      ],
    };
    expect(() => ZContactBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject request with empty email value", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: [
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "",
            },
          ],
        },
      ],
    };
    expect(() => ZContactBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject request with invalid email format", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: [
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "invalid-email",
            },
          ],
        },
      ],
    };
    expect(() => ZContactBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject request with duplicate emails across contacts", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: [
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "test@example.com",
            },
          ],
        },
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "test@example.com",
            },
          ],
        },
      ],
    };
    expect(() => ZContactBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject request with duplicate userIds across contacts", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: [
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "test1@example.com",
            },
            {
              attributeKey: {
                key: "userId",
                name: "User ID",
              },
              value: "user123",
            },
          ],
        },
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "test2@example.com",
            },
            {
              attributeKey: {
                key: "userId",
                name: "User ID",
              },
              value: "user123",
            },
          ],
        },
      ],
    };
    expect(() => ZContactBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject request with duplicate attribute keys within same contact", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: [
        {
          attributes: [
            {
              attributeKey: {
                key: "email",
                name: "Email",
              },
              value: "test@example.com",
            },
            {
              attributeKey: {
                key: "email",
                name: "Email Duplicate",
              },
              value: "test2@example.com",
            },
          ],
        },
      ],
    };
    expect(() => ZContactBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject request exceeding 250 contacts", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      contacts: Array.from({ length: 251 }, (_, i) => ({
        attributes: [
          {
            attributeKey: {
              key: "email",
              name: "Email",
            },
            value: `test${i}@example.com`,
          },
        ],
      })),
    };
    expect(() => ZContactBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });
});

describe("ZContactCreateRequest", () => {
  test("should validate valid create request with simplified flat attributes", () => {
    const validRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      },
    };
    const result = ZContactCreateRequest.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  test("should validate create request with only email attribute", () => {
    const validRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
      },
    };
    const result = ZContactCreateRequest.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  test("should reject create request without email attribute", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        firstName: "John",
        lastName: "Doe",
      },
    };
    expect(() => ZContactCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with invalid email format", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "invalid-email",
        firstName: "John",
      },
    };
    expect(() => ZContactCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with empty email", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "",
        firstName: "John",
      },
    };
    expect(() => ZContactCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with invalid workspaceId", () => {
    const invalidRequest = {
      workspaceId: "",
      attributes: {
        email: "test@example.com",
      },
    };
    expect(() => ZContactCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });
});

describe("ZContactResponse", () => {
  test("should validate valid contact response with flat string attributes", () => {
    const validResponse = {
      id: "cld1234567890abcdef123456",
      createdAt: new Date(),
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      },
    };
    const result = ZContactResponse.parse(validResponse);
    expect(result).toEqual(validResponse);
  });

  test("should validate contact response with only email attribute", () => {
    const validResponse = {
      id: "cld1234567890abcdef123456",
      createdAt: new Date(),
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
      },
    };
    const result = ZContactResponse.parse(validResponse);
    expect(result).toEqual(validResponse);
  });

  test("should reject contact response with null attribute values", () => {
    const invalidResponse = {
      id: "cld1234567890abcdef123456",
      createdAt: new Date(),
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
        firstName: "John",
        lastName: null,
      },
    };
    expect(() => ZContactResponse.parse(invalidResponse)).toThrow(ZodError);
  });

  test("should reject contact response with invalid id format", () => {
    const invalidResponse = {
      id: "invalid-id",
      createdAt: new Date(),
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
      },
    };
    expect(() => ZContactResponse.parse(invalidResponse)).toThrow(ZodError);
  });

  test("should reject contact response with invalid workspaceId format", () => {
    const invalidResponse = {
      id: "cld1234567890abcdef123456",
      createdAt: new Date(),
      workspaceId: "",
      attributes: {
        email: "test@example.com",
      },
    };
    expect(() => ZContactResponse.parse(invalidResponse)).toThrow(ZodError);
  });
});

describe("validateEmailAttribute", () => {
  test("should validate email attribute successfully", () => {
    const attributes = [
      {
        attributeKey: {
          key: "email",
          name: "Email",
        },
        value: "test@example.com",
      },
    ];
    const mockCtx = {
      addIssue: () => {},
    } as any;
    const result = validateEmailAttribute(attributes, mockCtx);
    expect(result.isValid).toBe(true);
    expect(result.emailAttr).toEqual(attributes[0]);
  });

  test("should fail validation when email attribute is missing", () => {
    const attributes = [
      {
        attributeKey: {
          key: "firstName",
          name: "First Name",
        },
        value: "John",
      },
    ];
    const mockCtx = {
      addIssue: () => {},
    } as any;
    const result = validateEmailAttribute(attributes, mockCtx);
    expect(result.isValid).toBe(false);
    expect(result.emailAttr).toBeUndefined();
  });

  test("should fail validation when email value is empty", () => {
    const attributes = [
      {
        attributeKey: {
          key: "email",
          name: "Email",
        },
        value: "",
      },
    ];
    const mockCtx = {
      addIssue: () => {},
    } as any;
    const result = validateEmailAttribute(attributes, mockCtx);
    expect(result.isValid).toBe(false);
  });

  test("should fail validation when email format is invalid", () => {
    const attributes = [
      {
        attributeKey: {
          key: "email",
          name: "Email",
        },
        value: "invalid-email",
      },
    ];
    const mockCtx = {
      addIssue: () => {},
    } as any;
    const result = validateEmailAttribute(attributes, mockCtx);
    expect(result.isValid).toBe(false);
  });

  test("should include contact index in error messages when provided", () => {
    const attributes = [
      {
        attributeKey: {
          key: "firstName",
          name: "First Name",
        },
        value: "John",
      },
    ];
    const mockCtx = {
      addIssue: () => {},
    } as any;
    const result = validateEmailAttribute(attributes, mockCtx, 5);
    expect(result.isValid).toBe(false);
  });
});

describe("validateUniqueAttributeKeys", () => {
  test("should pass validation for unique attribute keys", () => {
    const attributes = [
      {
        attributeKey: {
          key: "email",
          name: "Email",
        },
        value: "test@example.com",
      },
      {
        attributeKey: {
          key: "firstName",
          name: "First Name",
        },
        value: "John",
      },
    ];
    const mockCtx = {
      addIssue: vi.fn(),
    } as any;
    validateUniqueAttributeKeys(attributes, mockCtx);
    expect(mockCtx.addIssue).not.toHaveBeenCalled();
  });

  test("should fail validation for duplicate attribute keys", () => {
    const attributes = [
      {
        attributeKey: {
          key: "email",
          name: "Email",
        },
        value: "test@example.com",
      },
      {
        attributeKey: {
          key: "email",
          name: "Email Duplicate",
        },
        value: "test2@example.com",
      },
    ];
    let issueAdded = false;
    const mockCtx = {
      addIssue: () => {
        issueAdded = true;
      },
    } as any;
    validateUniqueAttributeKeys(attributes, mockCtx);
    expect(issueAdded).toBe(true);
  });

  test("should include contact index in error messages when provided", () => {
    const attributes = [
      {
        attributeKey: {
          key: "email",
          name: "Email",
        },
        value: "test@example.com",
      },
      {
        attributeKey: {
          key: "email",
          name: "Email Duplicate",
        },
        value: "test2@example.com",
      },
    ];
    let issueAdded = false;
    const mockCtx = {
      addIssue: () => {
        issueAdded = true;
      },
    } as any;
    validateUniqueAttributeKeys(attributes, mockCtx, 3);
    expect(issueAdded).toBe(true);
  });
});
