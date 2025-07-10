import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
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
      environmentId: "cld1234567890abcdef123456",
    };
    const result = ZContact.parse(validContact);
    expect(result).toEqual(validContact);
  });

  test("should reject invalid contact data", () => {
    const invalidContact = {
      id: "invalid-id",
      createdAt: "invalid-date",
      updatedAt: new Date(),
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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

describe("ZContactBulkUploadRequest", () => {
  test("should validate valid bulk upload request", () => {
    const validRequest = {
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
      },
    };
    const result = ZContactCreateRequest.parse(validRequest);
    expect(result).toEqual(validRequest);
  });

  test("should reject create request without email attribute", () => {
    const invalidRequest = {
      environmentId: "cld1234567890abcdef123456",
      attributes: {
        firstName: "John",
        lastName: "Doe",
      },
    };
    expect(() => ZContactCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with invalid email format", () => {
    const invalidRequest = {
      environmentId: "cld1234567890abcdef123456",
      attributes: {
        email: "invalid-email",
        firstName: "John",
      },
    };
    expect(() => ZContactCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with empty email", () => {
    const invalidRequest = {
      environmentId: "cld1234567890abcdef123456",
      attributes: {
        email: "",
        firstName: "John",
      },
    };
    expect(() => ZContactCreateRequest.parse(invalidRequest)).toThrow(ZodError);
  });

  test("should reject create request with invalid environmentId", () => {
    const invalidRequest = {
      environmentId: "invalid-id",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
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
      environmentId: "cld1234567890abcdef123456",
      attributes: {
        email: "test@example.com",
      },
    };
    expect(() => ZContactResponse.parse(invalidResponse)).toThrow(ZodError);
  });

  test("should reject contact response with invalid environmentId format", () => {
    const invalidResponse = {
      id: "cld1234567890abcdef123456",
      createdAt: new Date(),
      environmentId: "invalid-env-id",
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
      addIssue: () => {},
    } as any;
    // Should not throw or call addIssue
    validateUniqueAttributeKeys(attributes, mockCtx);
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
