import { describe, expect, test } from "vitest";
import { buildPlainIdentity } from "./customer-details";

describe("buildPlainIdentity", () => {
  test("never sends an email without its signature", () => {
    expect(
      buildPlainIdentity({ userEmail: "john@example.com", customerDetailsSignature: null })
    ).toBeUndefined();
    expect(buildPlainIdentity({ userEmail: "john@example.com" })).toBeUndefined();
    expect(
      buildPlainIdentity({ userEmail: "john@example.com", customerDetailsSignature: "" })
    ).toBeUndefined();
  });

  test("returns no identity without an email", () => {
    expect(buildPlainIdentity({ userEmail: null, customerDetailsSignature: "sig" })).toBeUndefined();
    expect(buildPlainIdentity({})).toBeUndefined();
  });

  test("sends the signed identity with display fields", () => {
    expect(
      buildPlainIdentity({
        userEmail: "john@example.com",
        customerDetailsSignature: "sig",
        userName: "John Doe",
        userId: "user_1",
      })
    ).toEqual({
      customerDetails: {
        email: "john@example.com",
        fullName: "John Doe",
        shortName: "John",
        externalId: "user_1",
      },
      customerDetailsSignature: "sig",
    });
  });

  test("leaves optional fields undefined when unknown", () => {
    expect(buildPlainIdentity({ userEmail: "john@example.com", customerDetailsSignature: "sig" })).toEqual({
      customerDetails: {
        email: "john@example.com",
        fullName: undefined,
        shortName: undefined,
        externalId: undefined,
      },
      customerDetailsSignature: "sig",
    });
  });
});
