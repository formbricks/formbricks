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
  ZContactCSVRecords,
  ZContactCreateRequest,
  ZContactResponse,
  ZContactTableData,
  ZContactWithAttributes,
  getContactBulkUploadRequestSchema,
  getContactCSVUploadSchema,
  getContactCreateRequestSchema,
  validateIdentityAttribute,
  validateUniqueAttributeKeys,
} from "./contact";

const ZEmailCSVUpload = getContactCSVUploadSchema("email");
const ZEmailBulkUploadRequest = getContactBulkUploadRequestSchema("email");
const ZEmailCreateRequest = getContactCreateRequestSchema("email");

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

describe("getContactCSVUploadSchema (email directory)", () => {
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
    const result = ZEmailCSVUpload.parse(validData);
    expect(result).toEqual(validData);
  });

  test("should reject data without email field", () => {
    const invalidData = [
      {
        firstName: "John",
        lastName: "Doe",
      },
    ];
    expect(() => ZEmailCSVUpload.parse(invalidData)).toThrow(ZodError);
  });

  test("should reject data with empty email", () => {
    const invalidData = [
      {
        email: "",
        firstName: "John",
        lastName: "Doe",
      },
    ];
    expect(() => ZEmailCSVUpload.parse(invalidData)).toThrow(ZodError);
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
    expect(() => ZEmailCSVUpload.parse(invalidData)).toThrow(ZodError);
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
    expect(() => ZEmailCSVUpload.parse(invalidData)).toThrow(ZodError);
  });

  test("should reject data exceeding 10000 records", () => {
    const invalidData = Array.from({ length: 10001 }, (_, i) => ({
      email: `test${i}@example.com`,
      firstName: "John",
      lastName: "Doe",
    }));
    expect(() => ZEmailCSVUpload.parse(invalidData)).toThrow(ZodError);
  });
});

describe("getContactCSVUploadSchema (external ID directory)", () => {
  const schema = getContactCSVUploadSchema("externalId");

  // An email belongs to one contact of a directory, as identify keeps it, whatever the directory matches by.
  test("refuses two rows with one email", () => {
    const result = schema.safeParse([
      { externalId: "CRM-1", email: "shared@example.com" },
      { externalId: "CRM-2", email: "shared@example.com" },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Duplicate emails found in the records");
  });

  test("accepts distinct emails, and rows without one", () => {
    const rows = [
      { externalId: "CRM-1", email: "a@example.com" },
      { externalId: "CRM-2", email: "b@example.com" },
      { externalId: "CRM-3", email: "" },
      { externalId: "CRM-4", email: "" },
    ];
    expect(schema.safeParse(rows).success).toBe(true);
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
  const csvSchema = getContactCSVUploadSchema("email");
  const issues = (result: { success: boolean; error?: ZodError }) =>
    result.error?.issues.map(({ message, path }) => ({ message, path })) ?? [];
  const record = (extra: Record<string, string> = {}) => ({ email: "ada@example.com", ...extra });
  /** A record of `count` columns, the email among them. */
  const columns = (count: number) =>
    record(Object.fromEntries(Array.from({ length: count - 1 }, (_, i) => [`column_${i}`, "x"])));

  test(`takes ${CSV_IMPORT_MAX_RECORDS} records and refuses one more with the existing message`, () => {
    const records = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ email: `user${i}@example.com` }));

    expect(csvSchema.safeParse(records(CSV_IMPORT_MAX_RECORDS)).success).toBe(true);
    expect(issues(csvSchema.safeParse(records(CSV_IMPORT_MAX_RECORDS + 1)))).toEqual([
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
    expect(csvSchema.safeParse([atLimit]).success).toBe(true);
    expect(issues(csvSchema.safeParse([record(), pastLimit]))).toEqual([
      { message: message.replace("record 1", "record 2"), path: [1] },
    ]);
  });

  test("reports one issue however many cells break a cap, before the typed schema runs", () => {
    const bad = Array.from({ length: 50 }, (_, i) => ({
      email: `u${i}@example.com`,
      note: 1 as unknown as string,
    }));

    expect(issues(csvSchema.safeParse(bad))).toEqual([
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

describe("getContactBulkUploadRequestSchema (email directory)", () => {
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
    const result = ZEmailBulkUploadRequest.parse(validRequest);
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
    expect(() => ZEmailBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
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
    expect(() => ZEmailBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
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
    expect(() => ZEmailBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
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
    expect(() => ZEmailBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
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
    expect(() => ZEmailBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
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
    expect(() => ZEmailBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
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
    expect(() => ZEmailBulkUploadRequest.parse(invalidRequest)).toThrow(ZodError);
  });
});

describe("getContactCreateRequestSchema (email directory)", () => {
  test("should validate valid create request with simplified flat attributes", () => {
    const validRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      },
    };
    const result = ZEmailCreateRequest.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  test("should validate create request with only email attribute", () => {
    const validRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
      },
    };
    const result = ZEmailCreateRequest.parse(validRequest);
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
    expect(() => ZEmailCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with invalid email format", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "invalid-email",
        firstName: "John",
      },
    };
    expect(() => ZEmailCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with empty email", () => {
    const invalidRequest = {
      workspaceId: "cld1234567890abcdef123456",
      attributes: {
        email: "",
        firstName: "John",
      },
    };
    expect(() => ZEmailCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with invalid workspaceId", () => {
    const invalidRequest = {
      workspaceId: "",
      attributes: {
        email: "test@example.com",
      },
    };
    expect(() => ZEmailCreateRequest.parse(invalidRequest)).toThrow(ZodError);
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

describe("validateIdentityAttribute", () => {
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
    } as unknown as Parameters<typeof validateIdentityAttribute>[1];
    const result = validateIdentityAttribute(attributes, mockCtx, "email");
    expect(result.isValid).toBe(true);
    expect(result.identityAttr).toEqual(attributes[0]);
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
    } as unknown as Parameters<typeof validateIdentityAttribute>[1];
    const result = validateIdentityAttribute(attributes, mockCtx, "email");
    expect(result.isValid).toBe(false);
    expect(result.identityAttr).toBeUndefined();
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
    } as unknown as Parameters<typeof validateIdentityAttribute>[1];
    const result = validateIdentityAttribute(attributes, mockCtx, "email");
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
    } as unknown as Parameters<typeof validateIdentityAttribute>[1];
    const result = validateIdentityAttribute(attributes, mockCtx, "email");
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
    } as unknown as Parameters<typeof validateIdentityAttribute>[1];
    const result = validateIdentityAttribute(attributes, mockCtx, "email", 5);
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
    } as unknown as Parameters<typeof validateUniqueAttributeKeys>[1];
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
    } as unknown as Parameters<typeof validateUniqueAttributeKeys>[1];
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
    } as unknown as Parameters<typeof validateUniqueAttributeKeys>[1];
    validateUniqueAttributeKeys(attributes, mockCtx, 3);
    expect(issueAdded).toBe(true);
  });
});

describe("identity checks for an external-ID directory", () => {
  const workspaceId = "cld1234567890abcdef123456";
  const bulkAttr = (key: string, value: string) => ({ attributeKey: { key, name: key }, value });
  const issueMessages = (result: { success: boolean; error?: ZodError }) =>
    result.error?.issues.map((issue) => issue.message) ?? [];

  test("CSV rows need an externalId column instead of email", () => {
    const schema = getContactCSVUploadSchema("externalId");

    expect(schema.safeParse([{ externalId: "crm-1" }]).success).toBe(true);
    expect(issueMessages(schema.safeParse([{ email: "a@example.com" }]))).toEqual([
      "Missing externalId field for one or more records",
    ]);
    expect(issueMessages(schema.safeParse([{ externalId: "" }]))).toEqual([
      "externalId field is empty for one or more records",
    ]);
    expect(issueMessages(schema.safeParse([{ externalId: "crm-1" }, { externalId: "crm-1" }]))).toEqual([
      "Duplicate externalIds found in the records",
    ]);
  });

  test("bulk contacts need a unique externalId, not a valid email", () => {
    const schema = getContactBulkUploadRequestSchema("externalId");

    expect(
      schema.safeParse({
        workspaceId,
        contacts: [{ attributes: [bulkAttr("externalId", "crm-1"), bulkAttr("email", "not-an-email")] }],
      }).success
    ).toBe(true);

    expect(
      issueMessages(
        schema.safeParse({ workspaceId, contacts: [{ attributes: [bulkAttr("email", "a@example.com")] }] })
      )
    ).toEqual(["externalId attribute is required for contact at index 0"]);

    const duplicates = schema.safeParse({
      workspaceId,
      contacts: [
        { attributes: [bulkAttr("externalId", "crm-1")] },
        { attributes: [bulkAttr("externalId", "crm-1")] },
      ],
    });
    expect(duplicates.error?.issues).toEqual([
      expect.objectContaining({
        message: "Duplicate externalIds found in the records, please ensure each externalId is unique.",
        params: { duplicateExternalIds: ["crm-1"] },
      }),
    ]);
  });

  test("create needs an externalId attribute and does not check email format", () => {
    const schema = getContactCreateRequestSchema("externalId");

    expect(schema.safeParse({ workspaceId, attributes: { externalId: "crm-1", email: "x" } }).success).toBe(
      true
    );
    expect(issueMessages(schema.safeParse({ workspaceId, attributes: { email: "a@example.com" } }))).toEqual([
      "externalId attribute is required",
    ]);
  });
});

describe("base request schemas (checked before the directory is known)", () => {
  test("accept rows and contacts without any identity attribute", () => {
    expect(ZContactCSVRecords.safeParse([{ firstName: "John" }]).success).toBe(true);
    expect(
      ZContactBulkUploadRequest.safeParse({
        workspaceId: "cld1234567890abcdef123456",
        contacts: [{ attributes: [{ attributeKey: { key: "firstName", name: "First" }, value: "J" }] }],
      }).success
    ).toBe(true);
    expect(
      ZContactCreateRequest.safeParse({
        workspaceId: "cld1234567890abcdef123456",
        attributes: { firstName: "John" },
      }).success
    ).toBe(true);
  });

  test("still enforce the row limit and unique userIds", () => {
    expect(ZContactCSVRecords.safeParse(Array.from({ length: 10001 }, () => ({}))).success).toBe(false);
    expect(
      ZContactBulkUploadRequest.safeParse({
        workspaceId: "cld1234567890abcdef123456",
        contacts: [
          { attributes: [{ attributeKey: { key: "userId", name: "User Id" }, value: "u-1" }] },
          { attributes: [{ attributeKey: { key: "userId", name: "User Id" }, value: "u-1" }] },
        ],
      }).success
    ).toBe(false);
  });
});

describe("email directory messages stay as before", () => {
  test("CSV, bulk and create keep their email texts", () => {
    expect(
      ZEmailCSVUpload.safeParse([{ firstName: "J" }]).error?.issues.map((issue) => issue.message)
    ).toEqual(["Missing email field for one or more records"]);
    expect(ZEmailCSVUpload.safeParse([{ email: "" }]).error?.issues[0].message).toBe(
      "Email field is empty for one or more records"
    );
    expect(
      ZEmailBulkUploadRequest.safeParse({
        workspaceId: "cld1234567890abcdef123456",
        contacts: [{ attributes: [{ attributeKey: { key: "email", name: "Email" }, value: "bad" }] }],
      }).error?.issues[0].message
    ).toBe("Invalid email format for contact at index 0");
    expect(
      ZEmailCreateRequest.safeParse({ workspaceId: "cld1234567890abcdef123456", attributes: {} }).error
        ?.issues[0].message
    ).toBe("Email attribute is required");
  });
});
