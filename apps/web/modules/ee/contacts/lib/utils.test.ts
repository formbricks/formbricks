import { describe, expect, test } from "vitest";
import { TTransformPersonInput } from "@/modules/ee/contacts/types/contact";
import { convertPrismaContactAttributes, getContactIdentifier, transformPrismaContact } from "./utils";

const mockPrismaAttributes = [
  { value: "john@example.com", attributeKey: { key: "email", name: "Email" } },
  { value: "John", attributeKey: { key: "name", name: "Name" } },
];

describe("utils", () => {
  test("getContactIdentifier returns email if present", () => {
    expect(getContactIdentifier({ email: "a@b.com", userId: "u1" })).toBe("a@b.com");
  });
  test("getContactIdentifier returns userId if no email", () => {
    expect(getContactIdentifier({ userId: "u1" })).toBe("u1");
  });
  test("getContactIdentifier returns empty string if neither", () => {
    expect(getContactIdentifier(null)).toBe("");
    expect(getContactIdentifier({})).toBe("");
  });

  test("convertPrismaContactAttributes returns correct object", () => {
    const result = convertPrismaContactAttributes(mockPrismaAttributes);
    expect(result).toEqual({
      email: { name: "Email", value: "john@example.com" },
      name: { name: "Name", value: "John" },
    });
  });

  test("transformPrismaContact returns correct structure", () => {
    const person: TTransformPersonInput = {
      id: "c1",
      environmentId: "env-1",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      attributes: [
        {
          attributeKey: { key: "email", name: "Email", dataType: "string" },
          value: "john@example.com",
          valueNumber: null,
          valueDate: null,
        },
        {
          attributeKey: { key: "name", name: "Name", dataType: "string" },
          value: "John",
          valueNumber: null,
          valueDate: null,
        },
      ],
    };
    const result = transformPrismaContact(person);
    expect(result.id).toBe("c1");
    expect(result.environmentId).toBe("env-1");
    expect(result.attributes).toEqual({ email: "john@example.com", name: "John" });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  test("transformPrismaContact resolves typed columns for number and date attributes", () => {
    const testDate = new Date("2024-06-15T10:30:00.000Z");
    const person: TTransformPersonInput = {
      id: "c2",
      environmentId: "env-1",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      attributes: [
        {
          attributeKey: { key: "age", name: "Age", dataType: "number" },
          value: "",
          valueNumber: 42,
          valueDate: null,
        },
        {
          attributeKey: { key: "signupDate", name: "Signup Date", dataType: "date" },
          value: "2024-06-15T10:30:00.000Z",
          valueNumber: null,
          valueDate: testDate,
        },
        {
          attributeKey: { key: "score", name: "Score", dataType: "number" },
          value: "99",
          valueNumber: null, // un-migrated: should fall back to value
          valueDate: null,
        },
      ],
    };
    const result = transformPrismaContact(person);
    expect(result.attributes).toEqual({
      age: "42",
      signupDate: testDate.toISOString(),
      score: "99", // fallback to value when valueNumber is null
    });
  });
});
