import { describe, expect, test } from "vitest";
import { buildPlainCustomerDetails } from "./customer-details";

describe("buildPlainCustomerDetails", () => {
  test("never sends an email without its verification hash", () => {
    expect(buildPlainCustomerDetails({ userEmail: "john@example.com", emailHash: null })).toBeUndefined();
    expect(buildPlainCustomerDetails({ userEmail: "john@example.com" })).toBeUndefined();
    expect(buildPlainCustomerDetails({ userEmail: "john@example.com", emailHash: "" })).toBeUndefined();
  });

  test("returns no identity without an email", () => {
    expect(buildPlainCustomerDetails({ userEmail: null, emailHash: "hash" })).toBeUndefined();
    expect(buildPlainCustomerDetails({})).toBeUndefined();
  });

  test("sends the verified identity with display fields", () => {
    expect(
      buildPlainCustomerDetails({
        userEmail: "john@example.com",
        emailHash: "hash",
        userName: "John Doe",
        userId: "user_1",
      })
    ).toEqual({
      email: "john@example.com",
      emailHash: "hash",
      fullName: "John Doe",
      shortName: "John",
      externalId: "user_1",
    });
  });

  test("leaves optional fields undefined when unknown", () => {
    expect(buildPlainCustomerDetails({ userEmail: "john@example.com", emailHash: "hash" })).toEqual({
      email: "john@example.com",
      emailHash: "hash",
      fullName: undefined,
      shortName: undefined,
      externalId: undefined,
    });
  });
});
