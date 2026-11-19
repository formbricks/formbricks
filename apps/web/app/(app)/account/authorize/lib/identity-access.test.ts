import { describe, expect, test } from "vitest";
import { getConsentIdentityAccess } from "./identity-access";

describe("getConsentIdentityAccess", () => {
  test("names the rows a request's scopes call for, in the screen's order", () => {
    expect(getConsentIdentityAccess(["openid", "email", "offline_access"])).toEqual([
      "name_and_email",
      "stay_signed_in",
    ]);
    expect(getConsentIdentityAccess(["profile"])).toEqual(["name_and_email"]);
    expect(getConsentIdentityAccess(["offline_access"])).toEqual(["stay_signed_in"]);
  });

  test("names nothing for a request that asks only for MCP scopes", () => {
    expect(getConsentIdentityAccess(["openid", "surveys:read"])).toEqual([]);
  });
});
