import { describe, expect, test } from "vitest";
import {
  V3_CONTACTS_MAX_LIMIT,
  V3_CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH,
  V3_CONTACT_MAX_ATTRIBUTES,
  ZV3ContactCountQuery,
  ZV3ContactListQuery,
  ZV3CreateContactAttributeKeyBody,
  ZV3PatchContactAttributeKeyBody,
  ZV3PatchContactBody,
  ZV3UpsertContactBody,
} from "./schemas";

const workspaceId = "clxx1234567890123456789012";

describe("ZV3ContactListQuery", () => {
  test("defaults to a small page", () => {
    expect(ZV3ContactListQuery.parse({ workspaceId }).limit).toBe(20);
  });

  test("bounds the page size at both ends, as a coerced query string", () => {
    expect(ZV3ContactListQuery.safeParse({ workspaceId, limit: String(V3_CONTACTS_MAX_LIMIT) }).success).toBe(
      true
    );
    expect(
      ZV3ContactListQuery.safeParse({ workspaceId, limit: String(V3_CONTACTS_MAX_LIMIT + 1) }).success
    ).toBe(false);
    expect(ZV3ContactListQuery.safeParse({ workspaceId, limit: "0" }).success).toBe(false);
  });

  test("refuses a key without its value and a value without its key", () => {
    expect(ZV3ContactListQuery.safeParse({ workspaceId, attributeKey: "plan" }).success).toBe(false);
    expect(ZV3ContactCountQuery.safeParse({ workspaceId, attributeValue: "pro" }).success).toBe(false);
    expect(
      ZV3ContactListQuery.safeParse({ workspaceId, attributeKey: "plan", attributeValue: "pro" }).success
    ).toBe(true);
  });

  test("rejects an unknown parameter instead of ignoring a filter", () => {
    expect(ZV3ContactListQuery.safeParse({ workspaceId, userid: "u_1" }).success).toBe(false);
  });

  test("requires a well-formed workspace id", () => {
    expect(ZV3ContactListQuery.safeParse({ workspaceId: "../x" }).success).toBe(false);
  });
});

describe("ZV3UpsertContactBody", () => {
  const body = { workspaceId, userId: "u_1" };

  test("takes the userId as its own field and refuses it inside attributes", () => {
    expect(ZV3UpsertContactBody.safeParse(body).success).toBe(true);
    expect(ZV3UpsertContactBody.safeParse({ ...body, attributes: { userId: "u_2" } }).success).toBe(false);
  });

  test("validates the email attribute", () => {
    expect(ZV3UpsertContactBody.safeParse({ ...body, attributes: { email: "a@b.co" } }).success).toBe(true);
    expect(ZV3UpsertContactBody.safeParse({ ...body, attributes: { email: "nope" } }).success).toBe(false);
    expect(ZV3UpsertContactBody.safeParse({ ...body, attributes: { email: 5 } }).success).toBe(false);
  });

  test("accepts strings, numbers and booleans, and bounds the value length", () => {
    expect(ZV3UpsertContactBody.safeParse({ ...body, attributes: { a: "x", b: 2, c: true } }).success).toBe(
      true
    );
    expect(ZV3UpsertContactBody.safeParse({ ...body, attributes: { a: null } }).success).toBe(false);
    expect(ZV3UpsertContactBody.safeParse({ ...body, attributes: { a: { nested: 1 } } }).success).toBe(false);
    expect(
      ZV3UpsertContactBody.safeParse({
        ...body,
        attributes: { a: "x".repeat(V3_CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH + 1) },
      }).success
    ).toBe(false);
  });

  test("refuses more attributes than a workspace can have keys, with one issue rather than one per entry", () => {
    const attributes = Object.fromEntries(
      Array.from({ length: V3_CONTACT_MAX_ATTRIBUTES + 1 }, (_, index) => [`k${index}`, { junk: true }])
    );

    const result = ZV3UpsertContactBody.safeParse({ ...body, attributes });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
  });

  test("rejects an undeclared field", () => {
    expect(ZV3UpsertContactBody.safeParse({ ...body, extra: 1 }).success).toBe(false);
  });
});

describe("ZV3PatchContactBody", () => {
  test("must change something", () => {
    expect(ZV3PatchContactBody.safeParse({}).success).toBe(false);
    expect(ZV3PatchContactBody.safeParse({ attributes: {} }).success).toBe(true);
  });

  test.each(["userId", "email", "firstName", "lastName"])("%s cannot be removed", (key) => {
    expect(ZV3PatchContactBody.safeParse({ removeAttributeKeys: [key] }).success).toBe(false);
  });

  test("a key cannot be set and removed in the same call", () => {
    expect(
      ZV3PatchContactBody.safeParse({ attributes: { plan: "pro" }, removeAttributeKeys: ["plan"] }).success
    ).toBe(false);
    expect(
      ZV3PatchContactBody.safeParse({ attributes: { plan: "pro" }, removeAttributeKeys: ["legacy"] }).success
    ).toBe(true);
  });
});

describe("attribute key bodies", () => {
  test.each(["Plan", "1plan", "my-plan", "plan name"])("%s is not a safe identifier", (key) => {
    expect(ZV3CreateContactAttributeKeyBody.safeParse({ workspaceId, key }).success).toBe(false);
  });

  test("the keys reserved for the default attribute migration are refused", () => {
    expect(ZV3CreateContactAttributeKeyBody.safeParse({ workspaceId, key: "user_id" }).success).toBe(false);
    expect(ZV3CreateContactAttributeKeyBody.safeParse({ workspaceId, key: "plan_tier" }).success).toBe(true);
  });

  test("only the three data types exist", () => {
    expect(
      ZV3CreateContactAttributeKeyBody.safeParse({ workspaceId, key: "a", dataType: "boolean" }).success
    ).toBe(false);
    expect(
      ZV3CreateContactAttributeKeyBody.safeParse({ workspaceId, key: "a", dataType: "date" }).success
    ).toBe(true);
  });

  test("a patch must change the name or the description", () => {
    expect(ZV3PatchContactAttributeKeyBody.safeParse({}).success).toBe(false);
    expect(ZV3PatchContactAttributeKeyBody.safeParse({ name: " " }).success).toBe(false);
    expect(ZV3PatchContactAttributeKeyBody.safeParse({ description: "x" }).success).toBe(true);
  });
});
