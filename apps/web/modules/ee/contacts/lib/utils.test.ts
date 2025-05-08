import { TTransformPersonInput } from "@/modules/ee/contacts/types/contact";
import { describe, expect, test } from "vitest";
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
      // createdAt: "2024-01-01T00:00:00.000Z",
      // updatedAt: "2024-01-02T00:00:00.000Z",
      attributes: [
        {
          attributeKey: { key: "email", name: "Email" },
          value: "john@example.com",
        },
        {
          attributeKey: { key: "name", name: "Name" },
          value: "John",
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
});
